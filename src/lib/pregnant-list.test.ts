// Run: node --import tsx --test src/lib/pregnant-list.test.ts
// (run it under TZ=Asia/Manila and TZ=UTC: the answers must not change)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPregnantList, inPregnancyWindow, listBarangays, TICK, type ListAppointment, type ListPatient, type ListStay } from './pregnant-list';
import { buildPregnantListCsv, pregnantListCsvRows, EMPTY_LIST_NOTE } from './pregnant-list-csv';
import { patientNameParts } from './patient-name';
import { parseManila } from './stays';
import { FIRST_TRIMESTER_LAST_WEEK, trimesterOf } from './prenatal-report';

const addr = (barangay: string, street = 'Purok 1') => ({ province: 'Samar', city: 'Calbayog City', barangay, street });
const pt = (uid: string, name: object, over: Partial<ListPatient> = {}): ListPatient =>
  ({ uid, name: patientNameParts(name), dob: '', address: null, dueDate: null, ...over });
const visit = (patientUid: string, date: string, over: Partial<ListAppointment> = {}): ListAppointment =>
  ({ patientUid, label: 'Prenatal Checkup', status: 'completed', date, ...over });
const build = (patients: ListPatient[], reportDate: string, appointments: ListAppointment[] = [], stays: ListStay[] = [], barangay: string | null = null) =>
  buildPregnantList({ reportDate, patients, appointments, stays, barangay });

test('inclusion window: 280 days before the due date to 14 days after', () => {
  const due = '2027-01-20';
  assert.ok(inPregnancyWindow(due, '2026-04-15')); // due - 280
  assert.ok(!inPregnancyWindow(due, '2026-04-14')); // due - 281
  assert.ok(inPregnancyWindow(due, '2027-01-20')); // due date
  assert.ok(inPregnancyWindow(due, '2027-02-03')); // due + 14
  assert.ok(!inPregnancyWindow(due, '2027-02-04')); // due + 15
});

test('a birth stay delivery on or before the report date excludes; a later one does not', () => {
  const p = [pt('a', { fullName: 'Ana Cruz' }, { dueDate: '2026-10-20' })];
  const stay = [{ patientUid: 'a', deliveredAt: parseManila('2026-10-21T09:00') }];
  assert.equal(build(p, '2026-10-20', [], stay).counts.listed, 1);
  assert.deepEqual(build(p, '2026-10-21', [], stay).counts, { listed: 0, noDueDate: 0, delivered: 1, outsideWindow: 0 });
  // A stay without a delivery never excludes.
  assert.equal(build(p, '2026-10-21', [], [{ patientUid: 'a', deliveredAt: null }]).counts.listed, 1);
});

test('no due date is counted, not listed; older ISO due dates read in Manila', () => {
  const r = build([pt('a', { fullName: 'Ana Cruz' }), pt('b', { fullName: 'Bea Cruz' }, { dueDate: '2027-01-19T16:00:00.000Z' })], '2026-10-26');
  assert.equal(r.counts.noDueDate, 1);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].gestation, '27 weeks'); // due Jan 20 in Manila
});

test('age on the report date, birthday boundary; missing values "Not recorded"', () => {
  const p = (dob: string) => [pt('a', { fullName: 'Ana Cruz' }, { dob, dueDate: '2027-01-20' })];
  assert.equal(build(p('2007-10-26'), '2026-10-26').rows[0].age, '19');
  assert.equal(build(p('2007-10-27'), '2026-10-26').rows[0].age, '18');
  const missing = build(p(''), '2026-10-26').rows[0];
  assert.equal(missing.age, 'Not recorded');
  assert.equal(missing.address, 'Not recorded');
  assert.equal(missing.gravida, 'Not recorded');
  assert.equal(missing.para, 'Not recorded');
  assert.deepEqual(missing.postnatal, ['Not recorded', 'Not recorded', 'Not recorded', 'Not recorded']);
});

test('band ticks at the visit date: weeks 13/14, 27/28, 37; two visits in one band; later visits ignored', () => {
  // Due 2027-01-20: week w starts on 2026-04-15 + 7w.
  const weekStart = (w: number) => { const d = new Date(Date.UTC(2026, 3, 15 + 7 * w)); return d.toISOString().slice(0, 10); };
  const p = [pt('a', { fullName: 'Ana Cruz' }, { dueDate: '2027-01-20' })];
  const r = build(p, '2027-01-20', [
    visit('a', weekStart(13)), visit('a', weekStart(14)),
    visit('a', weekStart(27)), visit('a', weekStart(28)),
    visit('a', weekStart(37)),
    visit('a', weekStart(21)), visit('a', weekStart(22)), // two in 21-27
    visit('a', weekStart(31), { status: 'missed' }),
    visit('a', weekStart(32), { label: 'Ultrasound' }),
  ]).rows[0];
  // Bands: 8-13, 14-20, 21-27, 28-30, 31-34, 35, 36, 37-40
  assert.deepEqual(r.bands, [TICK, TICK, TICK, TICK, '', '', '', TICK]);
  const early = build(p, weekStart(20), [visit('a', weekStart(13)), visit('a', weekStart(21))]).rows[0];
  assert.deepEqual(early.bands, [TICK, '', '', '', '', '', '', '']); // the week-21 visit is after the report date
});

test('barangay filter (case-insensitive) and the dropdown list', () => {
  const p = [
    pt('a', { firstName: 'Ana', lastName: 'Cruz' }, { dueDate: '2027-01-20', address: addr('San Isidro') }),
    pt('b', { firstName: 'Bea', lastName: 'Diaz' }, { dueDate: '2027-01-20', address: addr('san isidro ') }),
    pt('c', { firstName: 'Cora', lastName: 'Lim' }, { dueDate: '2027-01-20', address: addr('Tarabucan') }),
    pt('d', { firstName: 'Dina', lastName: 'Uy' }, { address: addr('San Isidro') }),
  ];
  assert.deepEqual(listBarangays(p), ['San Isidro', 'Tarabucan']);
  const r = build(p, '2026-10-26', [], [], 'SAN ISIDRO');
  assert.deepEqual(r.rows.map((x) => x.first), ['Ana', 'Bea']);
  assert.equal(r.counts.noDueDate, 1);
  assert.equal(build(p, '2026-10-26', [], [], 'Nowhere').rows.length, 0);
});

test('names: with middle, without middle, only fullName; sorted by last then first', () => {
  const r = build([
    pt('a', { firstName: 'Zoe', middleName: 'Reyes', lastName: 'Cruz', fullName: 'Zoe Reyes Cruz' }, { dueDate: '2027-01-20' }),
    pt('b', { firstName: 'Ana', lastName: 'Cruz' }, { dueDate: '2027-01-20' }),
    pt('c', { fullName: 'Maria Santos' }, { dueDate: '2027-01-20' }),
  ], '2026-10-26');
  assert.deepEqual(r.rows.map((x) => [x.no, x.last, x.first, x.middle]), [[1, 'Cruz', 'Ana', ''], [2, 'Cruz', 'Zoe', 'Reyes'], [3, 'Santos', 'Maria', '']]);
});

test('empty list: a clear message in the file', () => {
  const r = build([], '2026-10-26');
  assert.equal(r.rows.length, 0);
  assert.ok(pregnantListCsvRows(r).some((row) => row[1] === EMPTY_LIST_NOTE));
});

test('CSV: same rows and columns, BOM, CRLF, escaping, title block', () => {
  const r = build([
    pt('a', { firstName: '=Ana', lastName: 'Cruz, Jr.' }, { dueDate: '2027-01-20', dob: '1996-05-01', address: addr('San "Isidro"') }),
  ], '2026-10-26', [visit('a', '2026-09-01')]);
  const text = buildPregnantListCsv(r);
  assert.equal(text.charCodeAt(0), 0xfeff);
  assert.ok(!/[^\r]\n/.test(text) && !/\r(?!\n)/.test(text));
  const rows = pregnantListCsvRows(r);
  const header = rows.find((x) => x[0] === 'No.')!;
  const data = rows[rows.indexOf(header) + 1];
  assert.equal(header.length, 22);
  assert.equal(data.length, 22);
  assert.deepEqual(header.slice(6, 8), ['Age of gestation', 'Trimester']);
  assert.deepEqual(data.slice(0, 8), [1, 'Cruz, Jr.', '=Ana', '', '30', 'Purok 1, San "Isidro", Calbayog City, Samar', '27 weeks', '2nd']);
  assert.ok(rows.some((x) => x[0] === 'Note' && x[1] === 'Trimester is worked out from the due date on the report date; first trimester ends at week 13'));
  assert.ok(text.includes('"Cruz, Jr."'));
  assert.ok(text.includes('\t=Ana'));
  assert.ok(text.includes('"Purok 1, San ""Isidro"", Calbayog City, Samar"'));
  assert.ok(text.includes('CONFIDENTIAL: contains patient information'));
  assert.ok(rows.some((x) => x[0] === 'Report date' && x[1] === '2026-10-26'));
});

test('trimesterOf: rule A boundaries (first trimester ends at week 13), cap, null', () => {
  assert.equal(FIRST_TRIMESTER_LAST_WEEK, 13);
  const cases: [number | null, string | null][] = [[0, '1st'], [12, '1st'], [13, '1st'], [14, '2nd'], [27, '2nd'], [28, '3rd'], [40, '3rd'], [41, '3rd'], [null, null]];
  for (const [w, t] of cases) assert.equal(trimesterOf(w), t, String(w));
});

test('trimester per listed patient, from the same week as Age of gestation', () => {
  const R = '2026-10-26';
  // A due date that puts the report date at w weeks d days: due = R + 280 - (7w + d).
  const dueAt = (w: number, d: number) => { const x = new Date(`${R}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + 280 - (7 * w + d)); return x.toISOString().slice(0, 10); };
  const p = [
    pt('a', { firstName: 'A', lastName: 'Zz1' }, { dueDate: dueAt(12, 6) }),
    pt('b', { firstName: 'B', lastName: 'Zz2' }, { dueDate: dueAt(13, 0) }),
    pt('c', { firstName: 'C', lastName: 'Zz3' }, { dueDate: dueAt(27, 6) }),
    pt('d', { firstName: 'D', lastName: 'Zz4' }, { dueDate: dueAt(28, 0) }),
    pt('e', { firstName: 'E', lastName: 'Zz5' }),
    pt('f', { firstName: 'F', lastName: 'Zz6' }, { dueDate: 'not a date' }),
    pt('g', { firstName: 'G', lastName: 'Zz7' }, { dueDate: dueAt(30, 0) }),
  ];
  const stays = [{ patientUid: 'g', deliveredAt: parseManila('2026-10-20T08:00') }];
  const r = build(p, R, [], stays);
  assert.deepEqual(r.rows.map((x) => [x.last, x.gestation, x.trimester]), [
    ['Zz1', '12 weeks', '1st'], ['Zz2', '13 weeks', '1st'], ['Zz3', '27 weeks', '2nd'], ['Zz4', '28 weeks', '3rd'],
  ]);
  // Missing or unreadable due dates and a delivery stay keep the inclusion rule: counted, not listed.
  assert.deepEqual(r.counts, { listed: 4, noDueDate: 2, delivered: 1, outsideWindow: 0 });
  assert.deepEqual(r.trimesters, { first: 2, second: 1, third: 1, notAvailable: 0 });
  // A week later: 13 weeks becomes 14 (2nd), 27 weeks 6 days becomes 28 (3rd).
  const later = build(p, '2026-11-02', [], stays);
  assert.deepEqual(later.rows.map((x) => x.trimester), ['1st', '2nd', '3rd', '3rd']);
  assert.deepEqual(later.trimesters, { first: 1, second: 1, third: 2, notAvailable: 0 });
  // Each row's trimester agrees with its gestation, and the CSV carries the same cells.
  const csv = pregnantListCsvRows(r);
  const at = csv.findIndex((x) => x[0] === 'No.');
  r.rows.forEach((row, i) => {
    assert.equal(trimesterOf(Number.parseInt(row.gestation, 10)), row.trimester);
    assert.equal(csv[at + 1 + i][7], row.trimester);
  });
});
