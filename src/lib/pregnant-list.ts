// Pure data for the "List of Pregnant Women" (the clinic's paper list),
// for one report date. No Firebase or jsPDF imports; unit-tested in Node.
// Rows hold patient names and addresses: only the exported files show
// them, never the on-screen preview.

import { dueKey } from '@/lib/report-aggregations';
import { manilaDay } from '@/lib/stays';
import { FIRST_TRIMESTER_LAST_WEEK, GESTATION_BANDS, gestationalWeekOn, NOT_RECORDED, PRENATAL_LABEL, trimesterOf } from '@/lib/prenatal-report';
import { ageOnDate, formatAddress, readAddress } from '@/lib/patient-profile-fields';
import type { NameParts } from '@/lib/patient-name';

export const LIST_TITLE = 'LIST OF PREGNANT WOMEN';
export const LIST_DRAFT = 'Internal draft, not an official form';
export const LIST_SCOPE_NOTE = 'Only patients registered in MomCare are included.';
export const INCLUSION_RULE =
  'Listed: patients with a due date who are pregnant on the report date: the report date is between 280 days before the due date and 14 days after it, and no birth stay delivery is recorded on or before that date. Patients without a due date are counted, not listed.';
/** Days after the due date a patient is still listed (the app's own reminder cutoff). */
export const AFTER_DUE_DAYS = 14;
export const POSTNATAL_COLUMNS = ['Within 24 hrs', 'Day 3', '7-14 days', '6 weeks after'];
export const TICK = '/';
export const TRIMESTER_NOT_AVAILABLE = 'Not available';
export const LIST_TRIMESTER_NOTE = `Trimester is worked out from the due date on the report date; first trimester ends at ${FIRST_TRIMESTER_LAST_WEEK === 13 ? 'week 13' : '12 weeks 6 days'}`;

export interface ListPatient {
  uid: string;
  name: NameParts;
  /** Stored birthday ("YYYY-MM-DD", older ISO, '' or missing). */
  dob: unknown;
  /** Stored address (the app's map, an older string, or missing). */
  address: unknown;
  /** Stored due date (ISO or "YYYY-MM-DD"). */
  dueDate: unknown;
}

export interface ListAppointment {
  patientUid: string;
  label: string;
  status: string;
  /** "YYYY-MM-DD" */
  date: string;
}

export interface ListStay {
  patientUid: string;
  /** Epoch ms, or null when no delivery is recorded. */
  deliveredAt: number | null;
}

export interface ListRow {
  no: number;
  last: string;
  first: string;
  middle: string;
  age: string;
  address: string;
  gestation: string;
  /** '1st', '2nd', '3rd' or TRIMESTER_NOT_AVAILABLE, from the same week as gestation. */
  trimester: string;
  gravida: string;
  para: string;
  /** One cell per GESTATION_BANDS entry: TICK or ''. */
  bands: string[];
  postnatal: string[];
}

export interface PregnantList {
  reportDate: string;
  barangay: string | null;
  rows: ListRow[];
  counts: { listed: number; noDueDate: number; delivered: number; outsideWindow: number };
  /** Listed rows per trimester; they add up to counts.listed. */
  trimesters: { first: number; second: number; third: number; notAvailable: number };
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const lower = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

function addDays(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function isDayKey(v: unknown): v is string {
  return typeof v === 'string' && DAY.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
}

/** Distinct non-empty barangays (case-insensitive), sorted, first spelling kept. */
export function listBarangays(patients: ListPatient[]): string[] {
  const seen = new Map<string, string>();
  for (const p of patients) {
    const b = readAddress(p.address)?.barangay;
    if (b && !seen.has(lower(b))) seen.set(lower(b), b);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

/** True when the report date is inside the pregnancy window of a due date. */
export function inPregnancyWindow(due: string, reportDate: string): boolean {
  return reportDate >= addDays(due, -280) && reportDate <= addDays(due, AFTER_DUE_DAYS);
}

/** The list for a report date (and an optional barangay). */
export function buildPregnantList(input: {
  reportDate: string;
  barangay?: string | null;
  patients: ListPatient[];
  appointments: ListAppointment[];
  stays: ListStay[];
}): PregnantList {
  const { reportDate } = input;
  const barangay = input.barangay?.trim() ? input.barangay.trim() : null;
  const deliveredBy = new Set(
    input.stays.filter((s) => s.deliveredAt !== null && manilaDay(s.deliveredAt) <= reportDate).map((s) => s.patientUid)
  );
  const counts = { listed: 0, noDueDate: 0, delivered: 0, outsideWindow: 0 };
  const kept: { p: ListPatient; due: string }[] = [];

  for (const p of input.patients) {
    if (barangay && lower(readAddress(p.address)?.barangay ?? '') !== lower(barangay)) continue;
    const due = dueKey(typeof p.dueDate === 'string' ? p.dueDate : null);
    if (!due) { counts.noDueDate++; continue; }
    if (!inPregnancyWindow(due, reportDate)) { counts.outsideWindow++; continue; }
    if (deliveredBy.has(p.uid)) { counts.delivered++; continue; }
    kept.push({ p, due });
  }

  const visitsBy = new Map<string, string[]>();
  for (const a of input.appointments) {
    if (a.label !== PRENATAL_LABEL || a.status !== 'completed' || !DAY.test(a.date) || a.date > reportDate) continue;
    visitsBy.set(a.patientUid, [...(visitsBy.get(a.patientUid) ?? []), a.date]);
  }

  const sortKey = (n: NameParts) => [lower(n.last || n.full), lower(n.first)];
  kept.sort((a, b) => {
    const [al, af] = sortKey(a.p.name);
    const [bl, bf] = sortKey(b.p.name);
    return al.localeCompare(bl) || af.localeCompare(bf);
  });

  const rows = kept.map(({ p, due }, i): ListRow => {
    const ticks = new Set<number>();
    for (const date of visitsBy.get(p.uid) ?? []) {
      const week = gestationalWeekOn(due, date);
      const band = week === null ? -1 : GESTATION_BANDS.findIndex((b) => week >= b.min && week <= b.max);
      if (band >= 0) ticks.add(band);
    }
    const age = ageOnDate(p.dob, reportDate);
    const week = gestationalWeekOn(due, reportDate);
    return {
      no: i + 1,
      last: p.name.last || NOT_RECORDED,
      first: p.name.first || NOT_RECORDED,
      middle: p.name.middle,
      age: age === null ? NOT_RECORDED : String(age),
      address: formatAddress(readAddress(p.address)) ?? NOT_RECORDED,
      gestation: week === null ? NOT_RECORDED : `${week} weeks`,
      trimester: trimesterOf(week) ?? TRIMESTER_NOT_AVAILABLE,
      gravida: NOT_RECORDED,
      para: NOT_RECORDED,
      bands: GESTATION_BANDS.map((_, b) => (ticks.has(b) ? TICK : '')),
      postnatal: POSTNATAL_COLUMNS.map(() => NOT_RECORDED),
    };
  });
  counts.listed = rows.length;
  const trimesters = { first: 0, second: 0, third: 0, notAvailable: 0 };
  for (const r of rows) {
    if (r.trimester === '1st') trimesters.first++;
    else if (r.trimester === '2nd') trimesters.second++;
    else if (r.trimester === '3rd') trimesters.third++;
    else trimesters.notAvailable++;
  }
  return { reportDate, barangay, rows, counts, trimesters };
}

/** Column headings in the paper's order (flat, for the CSV). */
export const LIST_COLUMNS = [
  'No.', 'Last name', 'First name', 'Middle name', 'Age', 'Address', 'Age of gestation', 'Trimester', 'Gravida', 'Para',
  ...GESTATION_BANDS.map((b) => `${b.trimester === 1 ? '1st' : b.trimester === 2 ? '2nd' : '3rd'} tri ${b.label}`),
  ...POSTNATAL_COLUMNS.map((c) => `Postnatal ${c}`),
];

/** One row as cells, in LIST_COLUMNS order. */
export function rowCells(r: ListRow): (string | number)[] {
  return [r.no, r.last, r.first, r.middle, r.age, r.address, r.gestation, r.trimester, r.gravida, r.para, ...r.bands, ...r.postnatal];
}
