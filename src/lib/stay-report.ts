// Pure counting of birth stays for one Manila month, used by the Prenatal
// Services report (preview, PDF and CSV all read its result). No Firebase
// imports. Only patients registered in MomCare are included.

import { manilaDay, type Stay } from '@/lib/stays';

/** First month ("YYYY-MM") for which stays are recorded in MomCare. Earlier
 *  months show the stay rows as "Not recorded", never 0. */
export const STAYS_RECORDED_FROM = '2026-10';

export const STAYS_SCOPE_NOTE = 'Only patients registered in MomCare are included.';
export const CENSUS_NOTE =
  'CENSUS (provisional definition): for each day, mothers present (admitted on or before that day and not discharged before it) plus newborns present (born on or before that day, mother not discharged before it). A stay with no discharge date counts as present to the end of the month. TOTAL is the sum of the days.';

export interface ReportStay extends Stay {
  patientUid: string;
}

export type StayRowKey =
  | 'admissions' | 'admMother' | 'admNewborn' | 'census'
  | 'deliveries' | 'stillbirths' | 'discharges' | 'disMother' | 'disBaby' | 'transfers'
  | 'liveMale' | 'liveFemale';

export const STAY_ROW_LABELS: Record<StayRowKey, string> = {
  admissions: 'Admissions (mother + newborn)',
  admMother: 'Admissions: mother',
  admNewborn: 'Admissions: newborn',
  census: 'Census (provisional)',
  deliveries: 'Deliveries',
  stillbirths: 'Stillbirths',
  discharges: 'Discharges (mother + baby)',
  disMother: 'Discharges: mother',
  disBaby: 'Discharges: baby',
  transfers: 'Transfers to CDH',
  liveMale: 'Live births: male',
  liveFemale: 'Live births: female',
};

export interface StayReport {
  rows: Record<StayRowKey, { daily: number[]; total: number }>;
  /** Stays touching the month with no discharge date (counted present to month end). */
  withoutDischarge: { patientUid: string; admittedDay: string }[];
  /** Stays touching the month with no delivery recorded. */
  withoutOutcome: { patientUid: string; admittedDay: string }[];
}

/**
 * The month's stay rows, per day and in total. Twins (two stays of one
 * mother with the same admission and delivery time) are one admission,
 * one delivery and one discharge for the mother, two newborns. A transfer
 * never adds a delivery. Events count in the month they happen. Returns
 * null for months before STAYS_RECORDED_FROM.
 */
export function buildStayReport(month: string, days: string[], stays: ReportStay[]): StayReport | null {
  if (month < STAYS_RECORDED_FROM) return null;
  const index = new Map(days.map((d, i) => [d, i]));
  const zero = () => days.map(() => 0);
  const keys = Object.keys(STAY_ROW_LABELS) as StayRowKey[];
  const daily = Object.fromEntries(keys.map((k) => [k, zero()])) as Record<StayRowKey, number[]>;
  const seen = new Set<string>();
  /** Counts once per key (twins share the mother's events). */
  const once = (row: StayRowKey, ms: number | null, key: string) => {
    if (ms === null) return;
    const i = index.get(manilaDay(ms));
    if (i === undefined || seen.has(`${row}|${key}|${ms}`)) return;
    seen.add(`${row}|${key}|${ms}`);
    daily[row][i]++;
  };
  const each = (row: StayRowKey, ms: number | null) => {
    if (ms === null) return;
    const i = index.get(manilaDay(ms));
    if (i !== undefined) daily[row][i]++;
  };

  const first = days[0];
  const last = days[days.length - 1];
  const touches = (s: ReportStay) => manilaDay(s.admittedAt) <= last && (s.dischargedAt === null || manilaDay(s.dischargedAt) >= first);

  for (const s of stays) {
    const live = s.deliveredAt !== null && s.outcome === 'live';
    once('admMother', s.admittedAt, s.patientUid);
    if (live) each('admNewborn', s.deliveredAt);
    once('deliveries', s.deliveredAt, s.patientUid);
    if (s.deliveredAt !== null && s.outcome === 'stillbirth') each('stillbirths', s.deliveredAt);
    if (live && s.babySex === 'male') each('liveMale', s.deliveredAt);
    if (live && s.babySex === 'female') each('liveFemale', s.deliveredAt);
    once('disMother', s.dischargedAt, s.patientUid);
    if (live) each('disBaby', s.dischargedAt);
    once('transfers', s.transferredAt, s.patientUid);

    // Census: present from admission (mother) / birth (newborn) until the
    // discharge day, or to the end of the month without one.
    const out = s.dischargedAt === null ? null : manilaDay(s.dischargedAt);
    const present = (fromDay: string, key: string) => {
      days.forEach((d, i) => {
        if (fromDay <= d && (out === null || out >= d) && !seen.has(`census|${key}|${d}`)) {
          seen.add(`census|${key}|${d}`);
          daily.census[i]++;
        }
      });
    };
    present(manilaDay(s.admittedAt), `${s.patientUid}|${s.admittedAt}|mother`);
    if (live) present(manilaDay(s.deliveredAt!), `${s.patientUid}|${s.admittedAt}|baby|${stays.indexOf(s)}`);
  }
  days.forEach((_, i) => {
    daily.admissions[i] = daily.admMother[i] + daily.admNewborn[i];
    daily.discharges[i] = daily.disMother[i] + daily.disBaby[i];
  });

  const relevant = stays.filter(touches);
  const flag = (s: ReportStay) => ({ patientUid: s.patientUid, admittedDay: manilaDay(s.admittedAt) });
  return {
    rows: Object.fromEntries(keys.map((k) => [k, { daily: daily[k], total: daily[k].reduce((a, b) => a + b, 0) }])) as StayReport['rows'],
    withoutDischarge: relevant.filter((s) => s.dischargedAt === null).map(flag),
    withoutOutcome: relevant.filter((s) => s.deliveredAt === null).map(flag),
  };
}
