// Pure data for the admin activity summary PDF (from auditLogs). No
// Firebase or jsPDF imports, so it can be unit-tested with plain Node.
// Free-text details are never part of it.

import { actionLabel } from '@/lib/audit-labels';
import { manilaKey, type DateRange } from '@/lib/report-aggregations';

/** Most audit entries read for one summary; above this the report says so. */
export const MAX_ACTIVITY_ENTRIES = 5000;
/** How many of the newest entries the report lists. */
export const LATEST_ENTRIES = 40;
/** A period longer than this is charted per month instead of per day. */
export const MAX_DAY_BARS = 62;

export interface ActivityEntry {
  /** ISO, or null when unknown. */
  createdAt: string | null;
  actorRole: string;
  /** A readable actor: a name, else an email, else "Unknown". */
  actorName: string;
  action: string;
  targetLabel: string;
}

export interface ActivityReport {
  range: DateRange;
  generatedAt: string;
  capped: boolean;
  totals: { all: number; admin: number; doctor: number; patient: number };
  /** "day" keys are YYYY-MM-DD, "month" keys YYYY-MM. Every bucket in the span, zeros included. */
  timeline: { unit: 'day' | 'month'; buckets: { key: string; count: number }[] };
  byAction: { label: string; count: number }[];
  byActor: { name: string; role: string; count: number }[];
  /** Newest first. */
  latest: { at: string | null; actor: string; role: string; action: string; target: string }[];
}

const ROLE_LABEL: Record<string, string> = { admin: 'Admin', doctor: 'Doctor', patient: 'Patient' };
export const roleLabel = (role: string) => ROLE_LABEL[role] ?? 'Other';

function nextDay(key: string): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function nextMonth(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

/** Day buckets across the span (the period, or first to last entry), or month buckets when it is long. */
export function activityTimeline(dayKeys: string[], range: DateRange): ActivityReport['timeline'] {
  const sorted = [...dayKeys].sort();
  const first = range.from ?? sorted[0];
  const last = range.to ?? sorted[sorted.length - 1];
  if (!first || !last) return { unit: 'day', buckets: [] };

  const counts = new Map<string, number>();
  const days: string[] = [];
  for (let k = first; k <= last && days.length <= MAX_DAY_BARS; k = nextDay(k)) days.push(k);
  if (days.length <= MAX_DAY_BARS) {
    for (const k of dayKeys) counts.set(k, (counts.get(k) ?? 0) + 1);
    return { unit: 'day', buckets: days.map((key) => ({ key, count: counts.get(key) ?? 0 })) };
  }
  for (const k of dayKeys) counts.set(k.slice(0, 7), (counts.get(k.slice(0, 7)) ?? 0) + 1);
  const months: string[] = [];
  for (let m = first.slice(0, 7); m <= last.slice(0, 7); m = nextMonth(m)) months.push(m);
  return { unit: 'month', buckets: months.map((key) => ({ key, count: counts.get(key) ?? 0 })) };
}

/** The activity summary for entries already limited to the period (newest first). */
export function buildActivityReport(entries: ActivityEntry[], range: DateRange, now: Date, capped: boolean): ActivityReport {
  const byRole = (r: string) => entries.filter((e) => e.actorRole === r).length;

  const actions = new Map<string, number>();
  for (const e of entries) {
    const label = actionLabel(e.action);
    actions.set(label, (actions.get(label) ?? 0) + 1);
  }

  const actors = new Map<string, { name: string; role: string; count: number }>();
  for (const e of entries) {
    const role = roleLabel(e.actorRole);
    const key = `${role}\u0000${e.actorName}`;
    const a = actors.get(key) ?? { name: e.actorName, role, count: 0 };
    a.count++;
    actors.set(key, a);
  }

  const newestFirst = [...entries].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  const byCount = <T extends { count: number }>(a: T, b: T, tie: number) => b.count - a.count || tie;

  return {
    range,
    generatedAt: now.toISOString(),
    capped,
    totals: { all: entries.length, admin: byRole('admin'), doctor: byRole('doctor'), patient: byRole('patient') },
    timeline: activityTimeline(
      entries.flatMap((e) => (e.createdAt ? [manilaKey(new Date(e.createdAt))] : [])),
      range
    ),
    byAction: [...actions].map(([label, count]) => ({ label, count })).sort((a, b) => byCount(a, b, a.label.localeCompare(b.label))),
    byActor: [...actors.values()].sort((a, b) => byCount(a, b, a.name.localeCompare(b.name))),
    latest: newestFirst.slice(0, LATEST_ENTRIES).map((e) => ({
      at: e.createdAt,
      actor: e.actorName,
      role: roleLabel(e.actorRole),
      action: actionLabel(e.action),
      target: e.targetLabel && e.targetLabel !== '—' ? e.targetLabel : '-',
    })),
  };
}
