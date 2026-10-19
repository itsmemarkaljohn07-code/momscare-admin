// Pure aggregation for the PDF reports. No Firebase or jsPDF imports, so
// it can be unit-tested with plain Node; the report routes call it on the
// server and the browser only lays the result out.

import { isMissedAppointment } from '@/lib/appointment-status';

const CLINIC_TZ = 'Asia/Manila';
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A calendar date key (YYYY-MM-DD) in Manila for an instant. */
export function manilaKey(at: Date): string {
  return at.toLocaleDateString('en-CA', { timeZone: CLINIC_TZ });
}

function addDays(key: string, days: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function monthStart(key: string): string {
  return `${key.slice(0, 7)}-01`;
}

function monthEnd(key: string): string {
  const d = new Date(`${monthStart(key)}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
}

export function addMonths(monthKey: string, months: number): string {
  const d = new Date(`${monthKey.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 7);
}

// -- Date range ---------------------------------------------------------

export type RangePreset = 'this_month' | 'last_month' | 'last_30_days' | 'all_time';

export interface DateRange {
  from: string | null;
  to: string | null;
}

/** A preset as Manila calendar dates, relative to `today` (YYYY-MM-DD). */
export function rangeForPreset(preset: RangePreset, today: string): DateRange {
  if (preset === 'this_month') return { from: monthStart(today), to: monthEnd(today) };
  if (preset === 'last_month') {
    const prev = `${addMonths(today, -1)}-01`;
    return { from: prev, to: monthEnd(prev) };
  }
  if (preset === 'last_30_days') return { from: addDays(today, -29), to: today };
  return { from: null, to: null };
}

/** True when a valid range (from <= to when both are set). */
export function validRange(r: DateRange): boolean {
  if ((r.from && !DAY.test(r.from)) || (r.to && !DAY.test(r.to))) return false;
  return !(r.from && r.to && r.from > r.to);
}

export function inRange(date: string, r: DateRange): boolean {
  if (!DAY.test(date)) return false;
  if (r.from && date < r.from) return false;
  if (r.to && date > r.to) return false;
  return true;
}

// -- Appointments ---------------------------------------------------------

export interface ReportAppointment {
  patientName: string;
  label: string;
  doctor: string;
  /** YYYY-MM-DD */
  date: string;
  /** "9:00 AM" */
  time: string;
  status: string;
  /** requested | approved | declined | withdrawn, or null. */
  cancellationState: string | null;
}

export type ReportStatus = 'upcoming' | 'completed' | 'cancelled' | 'missed';

/** The status the dashboard shows: stored "missed", or still upcoming 3
 *  hours after its start, counts as missed. */
export function reportStatus(a: Pick<ReportAppointment, 'date' | 'time' | 'status'>, now: Date): ReportStatus | null {
  if (isMissedAppointment(a, now)) return 'missed';
  if (a.status === 'upcoming' || a.status === 'completed' || a.status === 'cancelled') return a.status;
  return null;
}

export interface StatusCounts {
  total: number;
  upcoming: number;
  completed: number;
  cancelled: number;
  missed: number;
}

export function countStatuses(rows: ReportAppointment[], now: Date): StatusCounts {
  const c: StatusCounts = { total: 0, upcoming: 0, completed: 0, cancelled: 0, missed: 0 };
  for (const a of rows) {
    c.total++;
    const s = reportStatus(a, now);
    if (s) c[s]++;
  }
  return c;
}

export function countsByMonth(rows: ReportAppointment[], now: Date): ({ month: string } & StatusCounts)[] {
  const map = new Map<string, ReportAppointment[]>();
  for (const a of rows) {
    const m = a.date.slice(0, 7);
    if (!map.has(m)) map.set(m, []);
    map.get(m)!.push(a);
  }
  return [...map.entries()].sort((x, y) => x[0].localeCompare(y[0])).map(([month, list]) => ({ month, ...countStatuses(list, now) }));
}

export function countsByDoctor(rows: ReportAppointment[], now: Date): ({ doctor: string } & StatusCounts)[] {
  const map = new Map<string, ReportAppointment[]>();
  for (const a of rows) {
    const d = a.doctor?.trim() || 'No doctor';
    if (!map.has(d)) map.set(d, []);
    map.get(d)!.push(a);
  }
  return [...map.entries()]
    .map(([doctor, list]) => ({ doctor, ...countStatuses(list, now) }))
    .sort((x, y) => y.total - x.total || x.doctor.localeCompare(y.doctor));
}

const DECISION_LABEL: Record<string, string> = {
  requested: 'Pending',
  approved: 'Approved',
  declined: 'Declined',
  withdrawn: 'Withdrawn by patient',
};

/** Appointments that had a cancellation request: patient, type, date,
 *  decision. No reasons. Newest appointment date first. */
export function cancellationRows(rows: ReportAppointment[]): { patientName: string; label: string; date: string; decision: string }[] {
  return rows
    .filter((a) => a.cancellationState && DECISION_LABEL[a.cancellationState])
    .sort((x, y) => y.date.localeCompare(x.date))
    .map((a) => ({ patientName: a.patientName, label: a.label, date: a.date, decision: DECISION_LABEL[a.cancellationState as string] }));
}

export interface AppointmentReport {
  range: DateRange;
  generatedAt: string;
  capped: boolean;
  counts: StatusCounts;
  byMonth: ({ month: string } & StatusCounts)[];
  byDoctor: ({ doctor: string } & StatusCounts)[];
  cancellations: { patientName: string; label: string; date: string; decision: string }[];
}

export function buildAppointmentReport(all: ReportAppointment[], range: DateRange, now: Date, capped: boolean): AppointmentReport {
  const rows = all.filter((a) => inRange(a.date, range));
  return {
    range,
    generatedAt: now.toISOString(),
    capped,
    counts: countStatuses(rows, now),
    byMonth: countsByMonth(rows, now),
    byDoctor: countsByDoctor(rows, now),
    cancellations: cancellationRows(rows),
  };
}
