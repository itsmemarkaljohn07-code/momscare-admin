// Pure data for the monthly Prenatal Services report (an internal draft
// for the clinic, not an official submission). No Firebase or jsPDF
// imports, so it can be unit-tested with plain Node. Dates are Philippine
// calendar dates, "YYYY-MM-DD"; appointment dates are stored that way.

import { ageOn } from '@/lib/date-of-birth';
import { buildStayReport, type ReportStay, type StayReport } from '@/lib/stay-report';

export const FACILITY = {
  name: 'San Joaquin Health Station and Birthing Home',
  location: 'Calbayog City',
};

export const DRAFT_LABEL = 'Internal draft, not an official submission';
export const NOT_RECORDED = 'Not recorded';

/** The appointment name that counts as a prenatal check-up. */
export const PRENATAL_LABEL = 'Prenatal Checkup';

export interface AgeGroup {
  label: string;
  min: number;
  max: number;
}

/**
 * Age groups for the report, by age in full years at the visit date.
 * "clinic" matches the clinic's monthly sheet; "doh" is the DOH grouping,
 * kept as an alternative. Switch with AGE_SPLIT. Every report also has an
 * "Age not recorded" column, and "Other ages" when the groups don't cover
 * every age.
 */
export const AGE_SPLITS: Record<'clinic' | 'doh', AgeGroup[]> = {
  clinic: [
    { label: '18 and below', min: 0, max: 18 },
    { label: '19 and above', min: 19, max: 200 },
  ],
  doh: [
    { label: '10-14', min: 10, max: 14 },
    { label: '15-19', min: 15, max: 19 },
    { label: '20-49', min: 20, max: 49 },
  ],
};
export const AGE_SPLIT: keyof typeof AGE_SPLITS = 'clinic';

export const AGE_NOT_RECORDED = 'Age not recorded';
export const OTHER_AGES = 'Other ages';

/** Gestation bands of the clinic's List of Pregnant Women, in completed weeks. */
export const GESTATION_BANDS: { label: string; min: number; max: number; trimester: 1 | 2 | 3 }[] = [
  { label: '8-13', min: 8, max: 13, trimester: 1 },
  { label: '14-20', min: 14, max: 20, trimester: 2 },
  { label: '21-27', min: 21, max: 27, trimester: 2 },
  { label: '28-30', min: 28, max: 30, trimester: 3 },
  { label: '31-34', min: 31, max: 34, trimester: 3 },
  { label: '35', min: 35, max: 35, trimester: 3 },
  { label: '36', min: 36, max: 36, trimester: 3 },
  { label: '37-40', min: 37, max: 40, trimester: 3 },
];
export const UNDER_8 = 'Under 8';

export const TRIMESTER_NOTE =
  'Gestational age is counted in completed weeks at the visit date from the due date (280-day model, capped at 40), the same rule as the rest of the dashboard. Trimesters: 1st weeks 0-13, 2nd weeks 14-27, 3rd weeks 28-40.';

/** Clinic sheet rows MomCare has no record for (before stays were recorded). */
export const NO_SOURCE_ROWS = [
  'Admissions: mother',
  'Admissions: newborn',
  'Admissions: census',
  'Deliveries: total, male, female',
  'Discharges: mother',
  'Discharges: baby',
  'Transfers to the district hospital',
  'OPD',
  'Postnatal check-ups (within 24 hours, day 3, days 7-14, 6 weeks)',
];

/** Clinic sheet rows still without a record once stays are recorded. */
export const NO_SOURCE_ROWS_WITH_STAYS = [
  'OPD',
  'Postnatal check-ups (within 24 hours, day 3, days 7-14, 6 weeks)',
];

export interface PrenatalAppointment {
  patientUid: string;
  label: string;
  status: string;
  /** "YYYY-MM-DD" */
  date: string;
  doctorApproval: string;
}

export interface PrenatalPatient {
  uid: string;
  name: string;
  /** "YYYY-MM-DD" or null. */
  dob: string | null;
  /** "YYYY-MM-DD" (Philippine date) or null. */
  dueDate: string | null;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^(\d{4})-(\d{2})$/;

export function isMonthKey(month: unknown): month is string {
  const m = typeof month === 'string' ? MONTH.exec(month) : null;
  return !!m && Number(m[2]) >= 1 && Number(m[2]) <= 12;
}

/** Every date of a month, "YYYY-MM-01" to its last day. */
export function daysOfMonth(month: string): string[] {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: last }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** Completed weeks of pregnancy on a date, from the due date (280-day
 *  model, 0 to 40), or null without a due date. */
export function gestationalWeekOn(dueDate: string | null, date: string): number | null {
  if (!dueDate || !DAY.test(dueDate) || !DAY.test(date)) return null;
  const elapsed = Math.max(0, Math.min(280, 280 - daysBetween(date, dueDate)));
  return Math.min(40, Math.floor(elapsed / 7));
}

/** Last completed week of the first trimester (rule A: 13, so 1st = weeks
 *  0-13, 2nd = 14-27, 3rd = 28-40; rule B would be 12). Switch it here. */
export const FIRST_TRIMESTER_LAST_WEEK = 13;
export const SECOND_TRIMESTER_LAST_WEEK = 27;
export type TrimesterName = '1st' | '2nd' | '3rd';

/** Trimester for completed weeks (above 40 counts as 3rd), or null without a week. */
export function trimesterOf(week: number | null): TrimesterName | null {
  if (week === null || !Number.isFinite(week) || week < 0) return null;
  if (week <= FIRST_TRIMESTER_LAST_WEEK) return '1st';
  if (week <= SECOND_TRIMESTER_LAST_WEEK) return '2nd';
  return '3rd';
}

/** The age-group column for an age (or null when not recorded). */
export function ageColumn(age: number | null, groups: AgeGroup[]): string {
  if (age === null || age < 0) return AGE_NOT_RECORDED;
  return groups.find((g) => age >= g.min && age <= g.max)?.label ?? OTHER_AGES;
}

export function gestationColumn(week: number | null): string {
  if (week === null) return NOT_RECORDED;
  return GESTATION_BANDS.find((b) => week >= b.min && week <= b.max)?.label ?? UNDER_8;
}

export interface PrenatalReport {
  month: string;
  facility: typeof FACILITY;
  generatedAt: string;
  ageSplit: keyof typeof AGE_SPLITS;
  /** Age columns in order, ending with "Age not recorded" (and "Other ages" before it when needed). */
  ageColumns: string[];
  /** One row per day of the month: visits per age column and the total. */
  daily: { date: string; byAge: number[]; total: number }[];
  totals: {
    visits: number;
    visitsByAge: number[];
    uniquePatients: number;
    /** Each patient once, in the column of her age at her first visit of the month. */
    uniqueByAge: number[];
  };
  /** Visits by gestational age at the visit. */
  gestation: { label: string; visits: number }[];
  dataQuality: {
    visitsWithoutDob: number;
    patientsWithoutDob: { uid: string; name: string }[];
    visitsWithoutDueDate: number;
    /** Completed prenatal visits the doctor hadn't approved (counted anyway). */
    visitsNotApproved: number;
    /** "Other" appointments in the month: not counted, check them. */
    otherAppointments: number;
    /** Prenatal appointments in the month that were not completed. */
    notCompleted: { upcoming: number; missed: number; cancelled: number };
  };
  noSourceRows: string[];
  /** Admissions, deliveries, discharges, transfers and census from birth
   *  stays; null for months before stays were recorded ("Not recorded"). */
  stays: StayReport | null;
  /** Stays to fix, with names, for the admin preview only (never in a file). */
  stayQuality: { withoutDischarge: { uid: string; name: string; admittedDay: string }[]; withoutOutcome: { uid: string; name: string; admittedDay: string }[] } | null;
}

/** The month's Prenatal Services numbers. A visit is a completed "Prenatal
 *  Checkup" appointment dated in the month. */
export function buildPrenatalReport(input: {
  month: string;
  appointments: PrenatalAppointment[];
  patients: PrenatalPatient[];
  now: Date;
  split?: keyof typeof AGE_SPLITS;
  /** Birth stays of registered patients (any month; counted by event date). */
  stays?: ReportStay[];
}): PrenatalReport {
  const split = input.split ?? AGE_SPLIT;
  const groups = AGE_SPLITS[split];
  const days = daysOfMonth(input.month);
  const inMonth = (a: PrenatalAppointment) => DAY.test(a.date) && a.date.startsWith(`${input.month}-`);
  const patients = new Map(input.patients.map((p) => [p.uid, p]));

  const monthAppts = input.appointments.filter(inMonth);
  const prenatal = monthAppts.filter((a) => a.label === PRENATAL_LABEL);
  const visits = prenatal
    .filter((a) => a.status === 'completed')
    .sort((a, b) => a.date.localeCompare(b.date));

  const columnOf = (a: PrenatalAppointment) => {
    const p = patients.get(a.patientUid);
    return ageColumn(p?.dob ? ageOn(p.dob, a.date) : null, groups);
  };
  const labels = visits.map(columnOf);
  const ageColumns = [
    ...groups.map((g) => g.label),
    ...(labels.includes(OTHER_AGES) ? [OTHER_AGES] : []),
    AGE_NOT_RECORDED,
  ];
  const idx = (label: string) => ageColumns.indexOf(label);

  const daily = days.map((date) => ({ date, byAge: ageColumns.map(() => 0), total: 0 }));
  const visitsByAge = ageColumns.map(() => 0);
  const firstColumn = new Map<string, string>();
  visits.forEach((a, i) => {
    const day = daily[Number(a.date.slice(8, 10)) - 1];
    day.byAge[idx(labels[i])]++;
    day.total++;
    visitsByAge[idx(labels[i])]++;
    if (!firstColumn.has(a.patientUid)) firstColumn.set(a.patientUid, labels[i]);
  });
  const uniqueByAge = ageColumns.map((c) => [...firstColumn.values()].filter((x) => x === c).length);

  const bandLabels = [UNDER_8, ...GESTATION_BANDS.map((b) => b.label), NOT_RECORDED];
  const bandCounts = new Map(bandLabels.map((l) => [l, 0]));
  for (const a of visits) {
    const label = gestationColumn(gestationalWeekOn(patients.get(a.patientUid)?.dueDate ?? null, a.date));
    bandCounts.set(label, (bandCounts.get(label) ?? 0) + 1);
  }

  const stays = buildStayReport(input.month, days, input.stays ?? []);
  const nameOf = (uid: string) => patients.get(uid)?.name || 'Unknown patient';

  const noDob = new Map<string, string>();
  for (const a of visits) {
    const p = patients.get(a.patientUid);
    if (!p?.dob) noDob.set(a.patientUid, p?.name || 'Unknown patient');
  }

  return {
    month: input.month,
    facility: FACILITY,
    generatedAt: input.now.toISOString(),
    ageSplit: split,
    ageColumns,
    daily,
    totals: { visits: visits.length, visitsByAge, uniquePatients: firstColumn.size, uniqueByAge },
    gestation: bandLabels.map((label) => ({ label, visits: bandCounts.get(label) ?? 0 })),
    dataQuality: {
      visitsWithoutDob: labels.filter((l) => l === AGE_NOT_RECORDED).length,
      patientsWithoutDob: [...noDob].map(([uid, name]) => ({ uid, name })).sort((a, b) => a.name.localeCompare(b.name)),
      visitsWithoutDueDate: bandCounts.get(NOT_RECORDED) ?? 0,
      visitsNotApproved: visits.filter((a) => a.doctorApproval !== 'approved').length,
      otherAppointments: monthAppts.filter((a) => a.label === 'Other').length,
      notCompleted: {
        upcoming: prenatal.filter((a) => a.status === 'upcoming').length,
        missed: prenatal.filter((a) => a.status === 'missed').length,
        cancelled: prenatal.filter((a) => a.status === 'cancelled').length,
      },
    },
    noSourceRows: stays ? NO_SOURCE_ROWS_WITH_STAYS : NO_SOURCE_ROWS,
    stays,
    stayQuality: stays
      ? {
          withoutDischarge: stays.withoutDischarge.map((x) => ({ uid: x.patientUid, name: nameOf(x.patientUid), admittedDay: x.admittedDay })),
          withoutOutcome: stays.withoutOutcome.map((x) => ({ uid: x.patientUid, name: nameOf(x.patientUid), admittedDay: x.admittedDay })),
        }
      : null,
  };
}
