// Run: node --import tsx --test src/lib/stay-report.test.ts
// (run it under TZ=Asia/Manila and TZ=UTC: the answers must not change)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseManila, type Stay } from './stays';
import { STAYS_RECORDED_FROM, buildStayReport, staysOfExistingPatients, type ReportStay } from './stay-report';
import { buildPrenatalReport, daysOfMonth } from './prenatal-report';
import { prenatalCsvRows } from './prenatal-report-csv';

const t = (v: string) => parseManila(v)!;
const s = (patientUid: string, over: Partial<Stay>): ReportStay => ({
  patientUid, admittedAt: t('2026-10-10T08:00'), deliveredAt: null, outcome: null, babySex: null,
  birthWeightG: null, birthLengthCm: null, dischargedAt: null, transferredAt: null, ...over,
});
const OCT = daysOfMonth('2026-10');
const day = (n: number) => n - 1;
const build = (stays: ReportStay[], month = '2026-10') => buildStayReport(month, daysOfMonth(month), stays)!;

test('admissions, deliveries, sexes, discharges on their Manila day', () => {
  const r = build([
    s('a', { admittedAt: t('2026-10-05T22:00'), deliveredAt: t('2026-10-06T03:00'), outcome: 'live', babySex: 'male', dischargedAt: t('2026-10-07T10:00') }),
    s('b', { admittedAt: t('2026-10-06T09:00'), deliveredAt: t('2026-10-06T15:00'), outcome: 'live', babySex: 'female', dischargedAt: t('2026-10-08T10:00') }),
  ]).rows;
  assert.equal(r.admMother.daily[day(5)], 1);
  assert.equal(r.admMother.daily[day(6)], 1);
  assert.equal(r.admNewborn.daily[day(6)], 2);
  assert.equal(r.deliveries.daily[day(6)], 2);
  assert.equal(r.liveMale.total, 1);
  assert.equal(r.liveFemale.total, 1);
  assert.equal(r.disMother.daily[day(7)], 1);
  assert.equal(r.disBaby.daily[day(7)], 1);
  assert.equal(r.admissions.total, r.admMother.total + r.admNewborn.total);
  assert.equal(r.discharges.total, r.disMother.total + r.disBaby.total);
  assert.equal(r.admissions.total, 4);
});

test('day and month boundaries: 23:59 and 00:01 Manila', () => {
  const r = build([
    s('a', { admittedAt: t('2026-09-30T23:59'), deliveredAt: t('2026-10-01T00:01'), outcome: 'live', babySex: 'male', dischargedAt: t('2026-10-31T23:59') }),
    s('b', { admittedAt: t('2026-10-31T23:59') }),
  ]).rows;
  assert.equal(r.admMother.total, 1); // the Sept 30 admission is September's
  assert.equal(r.admMother.daily[day(31)], 1);
  assert.equal(r.deliveries.daily[day(1)], 1);
  assert.equal(r.disMother.daily[day(31)], 1);
  const nov = build([s('b', { admittedAt: t('2026-10-31T23:59'), dischargedAt: t('2026-11-01T00:01') })], '2026-11').rows;
  assert.equal(nov.admMother.total, 0);
  assert.equal(nov.disMother.daily[0], 1);
});

test('a stay spanning two months counts each event in its own month; census both months', () => {
  const stays = [s('a', { admittedAt: t('2026-10-30T10:00'), deliveredAt: t('2026-11-01T02:00'), outcome: 'live', babySex: 'female', dischargedAt: t('2026-11-02T09:00') })];
  const oct = build(stays).rows;
  const nov = build(stays, '2026-11').rows;
  assert.deepEqual([oct.admMother.total, oct.deliveries.total, oct.disMother.total], [1, 0, 0]);
  assert.deepEqual([nov.admMother.total, nov.deliveries.total, nov.disMother.total, nov.disBaby.total], [0, 1, 1, 1]);
  assert.deepEqual([oct.census.daily[day(29)], oct.census.daily[day(30)], oct.census.daily[day(31)]], [0, 1, 1]);
  // Nov 1: mother + newborn; Nov 2: still present on the discharge day; Nov 3: gone.
  assert.deepEqual(nov.census.daily.slice(0, 3), [2, 2, 0]);
});

test('no discharge: present to month end, flagged', () => {
  const r = build([s('a', { admittedAt: t('2026-10-20T08:00'), deliveredAt: t('2026-10-20T12:00'), outcome: 'live', babySex: 'male' })]);
  assert.equal(r.rows.census.daily[day(19)], 0);
  assert.equal(r.rows.census.daily[day(20)], 2);
  assert.equal(r.rows.census.daily[day(31)], 2);
  assert.equal(r.withoutDischarge.length, 1);
  assert.equal(r.withoutOutcome.length, 0);
});

test('stillbirth: a delivery, no newborn, no sex, no baby discharge', () => {
  const r = build([s('a', { deliveredAt: t('2026-10-10T12:00'), outcome: 'stillbirth', dischargedAt: t('2026-10-11T12:00') })]).rows;
  assert.deepEqual([r.deliveries.total, r.stillbirths.total, r.admNewborn.total, r.liveMale.total, r.liveFemale.total, r.disBaby.total], [1, 1, 0, 0, 0, 0]);
  assert.equal(r.census.daily[day(10)], 1);
});

test('transfer without delivery: a transfer, never a delivery; flagged as no outcome', () => {
  const r = build([s('a', { transferredAt: t('2026-10-10T11:00'), dischargedAt: t('2026-10-10T11:00') })]);
  assert.deepEqual([r.rows.transfers.total, r.rows.deliveries.total], [1, 0]);
  assert.equal(r.withoutOutcome.length, 1);
});

test('twins: one admission, one delivery, one discharge for the mother; two newborns', () => {
  const twin = (sex: 'male' | 'female') =>
    s('a', { deliveredAt: t('2026-10-10T12:00'), outcome: 'live', babySex: sex, dischargedAt: t('2026-10-12T09:00') });
  const r = build([twin('male'), twin('female')]).rows;
  assert.deepEqual([r.admMother.total, r.deliveries.total, r.disMother.total], [1, 1, 1]);
  assert.deepEqual([r.admNewborn.total, r.liveMale.total, r.liveFemale.total, r.disBaby.total], [2, 1, 1, 2]);
  assert.equal(r.census.daily[day(10)], 3);
});

test('empty month before and after STAYS_RECORDED_FROM', () => {
  assert.equal(STAYS_RECORDED_FROM, '2026-10');
  assert.equal(buildStayReport('2026-09', daysOfMonth('2026-09'), []), null);
  const oct = build([]);
  assert.ok(Object.values(oct.rows).every((row) => row.total === 0 && row.daily.every((v) => v === 0)));
  assert.equal(OCT.length, 31);
});

test('preview data, CSV and the PDF all read the same counts', () => {
  const stays = [
    s('a', { admittedAt: t('2026-10-05T22:00'), deliveredAt: t('2026-10-06T03:00'), outcome: 'live', babySex: 'male', dischargedAt: t('2026-10-07T10:00') }),
    s('b', { admittedAt: t('2026-10-06T09:00'), deliveredAt: t('2026-10-06T15:00'), outcome: 'stillbirth', transferredAt: t('2026-10-06T16:00') }),
  ];
  const report = buildPrenatalReport({ month: '2026-10', appointments: [], patients: [], stays, now: new Date('2026-10-24T02:00:00Z') });
  const rows = prenatalCsvRows(report);
  const csv = (label: string, nth = 0) => rows.filter((r) => r[0] === label)[nth];
  assert.deepEqual(csv('NEWBORN').slice(1, -1), report.stays!.rows.admNewborn.daily);
  assert.equal(csv('II. DELIVERIES').at(-1), 2);
  assert.equal(csv('STILLBIRTH').at(-1), 1);
  assert.equal(csv('III. TRANSFER TO CDH').at(-1), 1);
  assert.equal(csv('MOTHER', 1).at(-1), 1); // discharges: mother
  assert.equal(csv('CENSUS (PROVISIONAL)').at(-1), report.stays!.rows.census.total);
  assert.deepEqual([csv('TOTAL OF DELIVERIES')[1], csv('MALE')[1], csv('FEMALE')[1]], [2, 1, 0]);
  assert.equal(report.stayQuality!.withoutDischarge.length, 1);
  // Before stays were recorded: "Not recorded", never 0.
  const sept = prenatalCsvRows(buildPrenatalReport({ month: '2026-09', appointments: [], patients: [], stays, now: new Date('2026-10-24T02:00:00Z') }));
  assert.equal(sept.find((r) => r[0] === 'II. DELIVERIES')!.at(-1), 'Not recorded');
  assert.equal(sept.find((r) => r[0] === 'TOTAL OF DELIVERIES')![1], 'Not recorded');
});

test('stays of a deleted patient are not counted', () => {
  const stays = [s('kept', { deliveredAt: t('2026-10-10T12:00'), outcome: 'live', babySex: 'male' }), s('gone', { deliveredAt: t('2026-10-11T12:00'), outcome: 'live', babySex: 'female' })];
  const kept = staysOfExistingPatients(stays, new Set(['kept']));
  assert.deepEqual(kept.map((x) => x.patientUid), ['kept']);
  assert.equal(build(kept).rows.deliveries.total, 1);
  assert.equal(build(kept).rows.liveFemale.total, 0);
});
