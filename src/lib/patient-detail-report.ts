// Pure data for the per-patient PDF report (admin or assigned doctor).
// No Firebase or jsPDF imports, so it can be unit-tested with plain Node.
// Clinical notes are never part of it.

import { computePregnancyWeek } from '@/lib/compute-pregnancy-week';
import { getTrimester, TRIMESTER_LABELS } from '@/lib/pregnancy-display';
import { dueKey, inRange, manilaKey, reportStatus, type DateRange } from '@/lib/report-aggregations';

export const NOT_RECORDED = 'Not recorded';
export const MOOD_NAMES = ['Low', 'Okay', 'Good', 'Great', 'Amazing'];

export interface PatientProfileInput {
  fullName: string;
  username: string | null;
  email: string | null;
  clinicName: string | null;
  dueDate: string | null;
  firstTimeMom: boolean | null;
}

export interface PatientAppointmentInput {
  date: string;
  time: string;
  label: string;
  type: string;
  doctor: string;
  status: string;
  doctorApproval: string;
}

export interface PatientSnapshotInput {
  /** ISO, or null when unknown. */
  createdAt: string | null;
  type: string;
  week: number | null;
  caption: string;
  health: { weight?: unknown; bpSys?: unknown; bpDia?: unknown; kicks?: unknown; mood?: unknown } | null;
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const text = (v: string | null | undefined): string => (v && v.trim() ? v.trim() : NOT_RECORDED);

const STATUS_LABEL: Record<string, string> = {
  upcoming: 'Upcoming', completed: 'Completed', cancelled: 'Cancelled', missed: 'Missed',
};
const APPROVAL_LABEL: Record<string, string> = { pending: 'Pending approval', approved: 'Approved', rejected: 'Declined' };
const SNAPSHOT_TYPE: Record<string, string> = { bump: 'Bump', ultrasound: 'Ultrasound', milestone: 'Milestone' };

export interface HealthRow {
  date: string;
  week: number | null;
  weight: number | null;
  bpSys: number | null;
  bpDia: number | null;
  kicks: number | null;
  mood: string | null;
}

export interface PatientDetailReport {
  patientName: string;
  range: DateRange;
  generatedAt: string;
  profile: { label: string; value: string }[];
  summary: { appointments: number; completed: number; snapshots: number; latestWeight: string; latestBp: string };
  appointments: { date: string; time: string; type: string; doctor: string; status: string; approval: string }[];
  health: HealthRow[];
  snapshots: { date: string; type: string; week: string; caption: string }[];
}

/** Everything the per-patient PDF shows, for the period. */
export function buildPatientDetailReport(input: {
  profile: PatientProfileInput;
  appointments: PatientAppointmentInput[];
  snapshots: PatientSnapshotInput[];
  range: DateRange;
  now: Date;
}): PatientDetailReport {
  const { profile, range, now } = input;
  const week = computePregnancyWeek(profile.dueDate, now.getTime());
  const trimester = getTrimester(week);
  const due = dueKey(profile.dueDate);

  const appts = input.appointments
    .filter((a) => inRange(a.date, range))
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

  const snaps = input.snapshots
    .map((s) => ({ ...s, day: s.createdAt ? manilaKey(new Date(s.createdAt)) : '' }))
    .filter((s) => (s.day ? inRange(s.day, range) : !range.from && !range.to))
    .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));

  const health: HealthRow[] = snaps
    .filter((s) => s.health)
    .map((s) => {
      const h = s.health!;
      const mood = num(h.mood);
      return {
        date: s.day,
        week: num(s.week),
        weight: num(h.weight),
        bpSys: num(h.bpSys),
        bpDia: num(h.bpDia),
        kicks: num(h.kicks),
        mood: mood !== null && MOOD_NAMES[mood] ? MOOD_NAMES[mood] : null,
      };
    });

  const latestWeight = [...health].reverse().find((h) => h.weight !== null)?.weight ?? null;
  const latestBp = [...health].reverse().find((h) => h.bpSys !== null && h.bpDia !== null) ?? null;

  return {
    patientName: profile.fullName || 'Patient',
    range,
    generatedAt: now.toISOString(),
    profile: [
      { label: 'Name', value: text(profile.fullName) },
      { label: 'Username', value: text(profile.username) },
      { label: 'Email', value: text(profile.email) },
      { label: 'Clinic', value: text(profile.clinicName) },
      { label: 'Due date', value: due ?? NOT_RECORDED },
      { label: 'Current week', value: week === null ? NOT_RECORDED : `Week ${week}` },
      { label: 'Trimester', value: trimester === null ? NOT_RECORDED : TRIMESTER_LABELS[trimester] },
      { label: 'First-time mom', value: profile.firstTimeMom === null ? NOT_RECORDED : profile.firstTimeMom ? 'Yes' : 'No' },
    ],
    summary: {
      appointments: appts.length,
      completed: appts.filter((a) => reportStatus(a, now) === 'completed').length,
      snapshots: snaps.length,
      latestWeight: latestWeight === null ? NOT_RECORDED : `${latestWeight} kg`,
      latestBp: latestBp ? `${latestBp.bpSys}/${latestBp.bpDia}` : NOT_RECORDED,
    },
    appointments: appts.map((a) => ({
      date: a.date,
      time: a.time || NOT_RECORDED,
      type: a.label || a.type || NOT_RECORDED,
      doctor: a.doctor || NOT_RECORDED,
      status: STATUS_LABEL[reportStatus(a, now) ?? ''] ?? (a.status || NOT_RECORDED),
      approval: APPROVAL_LABEL[a.doctorApproval] ?? NOT_RECORDED,
    })),
    health,
    snapshots: snaps.map((s) => ({
      date: s.day || NOT_RECORDED,
      type: SNAPSHOT_TYPE[s.type] ?? (s.type || NOT_RECORDED),
      week: num(s.week) === null ? NOT_RECORDED : String(s.week),
      caption: s.caption?.trim() || NOT_RECORDED,
    })),
  };
}

/** Points for a line chart: values with their row index, nulls skipped. */
export function seriesPoints(values: (number | null)[]): { i: number; v: number }[] {
  return values.flatMap((v, i) => (v === null ? [] : [{ i, v }]));
}

/** A padded [min, max] for a chart axis; a flat series gets a small range. */
export function axisRange(values: number[]): [number, number] {
  if (values.length === 0) return [0, 1];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = hi === lo ? Math.max(1, Math.abs(hi) * 0.05) : (hi - lo) * 0.1;
  return [Math.floor(lo - pad), Math.ceil(hi + pad)];
}
