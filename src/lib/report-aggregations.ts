// Pure aggregation for the PDF reports. No Firebase or jsPDF imports, so
// it can be unit-tested with plain Node; the report routes call it on the
// server and the browser only lays the result out.

import { isMissedAppointment } from '@/lib/appointment-status';
import { computePregnancyWeek } from '@/lib/compute-pregnancy-week';
import { getTrimester } from '@/lib/pregnancy-display';

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

// -- Patients (summary report) ------------------------------------------

export interface ReportPatient {
  name: string;
  /** As stored: an ISO timestamp or YYYY-MM-DD; null when not set. */
  dueDate: string | null;
  disabled: boolean;
  doctors: string[];
}

/** A due date as a Manila calendar date (YYYY-MM-DD), or null. */
export function dueKey(dueDate: string | null): string | null {
  if (!dueDate) return null;
  if (DAY.test(dueDate)) return dueDate;
  const d = new Date(dueDate);
  return Number.isNaN(d.getTime()) ? null : manilaKey(d);
}

/** Same week rule as the dashboard (280-day model, completed weeks, capped
 *  at 40) and the same trimester boundaries: weeks 0-13, 14-27, 28-40. */
export const TRIMESTER_BUCKETS = ['1st trimester (weeks 0-13)', '2nd trimester (weeks 14-27)', '3rd trimester (weeks 28-40)', 'No due date'] as const;

export function patientWeek(p: ReportPatient, now: Date): number | null {
  return computePregnancyWeek(p.dueDate, now.getTime());
}

export function countsByTrimester(patients: ReportPatient[], now: Date): { label: string; count: number }[] {
  const counts = [0, 0, 0, 0];
  for (const p of patients) {
    const t = getTrimester(patientWeek(p, now));
    counts[t === null ? 3 : t - 1]++;
  }
  return TRIMESTER_BUCKETS.map((label, i) => ({ label, count: counts[i] }));
}

export function patientsByDoctor(patients: ReportPatient[]): { label: string; count: number }[] {
  const map = new Map<string, number>();
  for (const p of patients) {
    const names = [...new Set(p.doctors.map((d) => d.trim()).filter(Boolean))];
    for (const n of names.length ? names : ['Not assigned']) map.set(n, (map.get(n) ?? 0) + 1);
  }
  return [...map.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** Due month buckets: "Earlier", the next 12 months from this one, "Later"
 *  (only when any), and "No due date". */
export function patientsByDueMonth(patients: ReportPatient[], today: string): { label: string; month: string | null; count: number }[] {
  const first = today.slice(0, 7);
  const months = Array.from({ length: 12 }, (_, i) => addMonths(first, i));
  const last = months[11];
  const counts = new Map<string, number>(months.map((m) => [m, 0]));
  let earlier = 0;
  let later = 0;
  let none = 0;
  for (const p of patients) {
    const key = dueKey(p.dueDate);
    if (!key) { none++; continue; }
    const m = key.slice(0, 7);
    if (m < first) earlier++;
    else if (m > last) later++;
    else counts.set(m, (counts.get(m) ?? 0) + 1);
  }
  return [
    { label: 'Earlier', month: null, count: earlier },
    ...months.map((m) => ({ label: m, month: m, count: counts.get(m) ?? 0 })),
    ...(later > 0 ? [{ label: 'Later', month: null, count: later }] : []),
    { label: 'No due date', month: null, count: none },
  ];
}

/** Patients due from today through today + `days` (Manila), soonest first. */
export function dueSoon(patients: ReportPatient[], today: string, now: Date, days = 60): { name: string; week: number | null; dueDate: string; doctors: string }[] {
  const end = addDays(today, days);
  return patients
    .map((p) => ({ p, key: dueKey(p.dueDate) }))
    .filter((x): x is { p: ReportPatient; key: string } => !!x.key && x.key >= today && x.key <= end)
    .sort((a, b) => a.key.localeCompare(b.key) || a.p.name.localeCompare(b.p.name))
    .map(({ p, key }) => ({ name: p.name, week: patientWeek(p, now), dueDate: key, doctors: p.doctors.filter(Boolean).join(', ') || 'Not assigned' }));
}

export interface PatientReport {
  asOf: string;
  generatedAt: string;
  summary: { total: number; active: number; suspended: number; withDueDate: number };
  byTrimester: { label: string; count: number }[];
  byDoctor: { label: string; count: number }[];
  byDueMonth: { label: string; month: string | null; count: number }[];
  dueSoon: { name: string; week: number | null; dueDate: string; doctors: string }[];
}

export function buildPatientReport(patients: ReportPatient[], now: Date): PatientReport {
  const today = manilaKey(now);
  return {
    asOf: today,
    generatedAt: now.toISOString(),
    summary: {
      total: patients.length,
      active: patients.filter((p) => !p.disabled).length,
      suspended: patients.filter((p) => p.disabled).length,
      withDueDate: patients.filter((p) => dueKey(p.dueDate) !== null).length,
    },
    byTrimester: countsByTrimester(patients, now),
    byDoctor: patientsByDoctor(patients),
    byDueMonth: patientsByDueMonth(patients, today),
    dueSoon: dueSoon(patients, today, now),
  };
}
