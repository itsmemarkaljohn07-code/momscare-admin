// Run: node --import tsx --test src/lib/prenatal-report.test.ts
// (run it under TZ=Asia/Manila and TZ=UTC: the answers must not change)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AGE_NOT_RECORDED, NOT_RECORDED, OTHER_AGES, UNDER_8, buildPrenatalReport, daysOfMonth, gestationalWeekOn,
  isMonthKey, type PrenatalAppointment, type PrenatalPatient,
} from './prenatal-report';

const NOW = new Date('2026-10-24T02:00:00Z');
const visit = (patientUid: string, date: string, over: Partial<PrenatalAppointment> = {}): PrenatalAppointment =>
  ({ patientUid, label: 'Prenatal Checkup', status: 'completed', date, doctorApproval: 'approved', ...over });
const patients: PrenatalPatient[] = [
  { uid: 'adult', name: 'Adult', dob: '1996-05-01', dueDate: '2027-03-15' },
  // Turns 19 on Oct 15, 2026.
  { uid: 'teen', name: 'Teen', dob: '2007-10-15', dueDate: '2026-12-01' },
  { uid: 'nodob', name: 'No Dob', dob: null, dueDate: null },
];
const build = (appointments: PrenatalAppointment[], month = '2026-10', split?: 'clinic' | 'doh') =>
  buildPrenatalReport({ month, appointments, patients, now: NOW, split });

test('month boundaries: first and last day in, neighbours out', () => {
  const r = build([visit('adult', '2026-09-30'), visit('adult', '2026-10-01'), visit('adult', '2026-10-31'), visit('adult', '2026-11-01')]);
  assert.equal(r.totals.visits, 2);
  assert.equal(r.daily.length, 31);
  assert.equal(r.daily[0].total, 1);
  assert.equal(r.daily[30].total, 1);
  assert.deepEqual(daysOfMonth('2028-02').length, 29);
  assert.deepEqual(daysOfMonth('2026-02').length, 28);
  assert.ok(isMonthKey('2026-10') && !isMonthKey('2026-13') && !isMonthKey('2026-1'));
});

test('two visits by one patient: visits 2, unique 1', () => {
  const r = build([visit('adult', '2026-10-05'), visit('adult', '2026-10-20')]);
  assert.equal(r.totals.visits, 2);
  assert.equal(r.totals.uniquePatients, 1);
  assert.deepEqual(r.ageColumns, ['18 and below', '19 and above', AGE_NOT_RECORDED]);
  assert.deepEqual(r.totals.visitsByAge, [0, 2, 0]);
  assert.deepEqual(r.totals.uniqueByAge, [0, 1, 0]);
});

test('age at the visit date; unique patient counted by her first visit', () => {
  const r = build([visit('teen', '2026-10-14'), visit('teen', '2026-10-15')]);
  assert.deepEqual(r.totals.visitsByAge, [1, 1, 0]);
  assert.deepEqual(r.totals.uniqueByAge, [1, 0, 0]);
  assert.equal(r.daily[13].byAge[0], 1);
  assert.equal(r.daily[14].byAge[1], 1);
});

test('missing date of birth goes to "Age not recorded", never into a group', () => {
  const r = build([visit('nodob', '2026-10-10'), visit('adult', '2026-10-10')]);
  assert.deepEqual(r.totals.visitsByAge, [0, 1, 1]);
  assert.equal(r.totals.visitsByAge.reduce((a, b) => a + b, 0), r.totals.visits);
  assert.equal(r.dataQuality.visitsWithoutDob, 1);
  assert.deepEqual(r.dataQuality.patientsWithoutDob, [{ uid: 'nodob', name: 'No Dob' }]);
  assert.equal(r.gestation.find((g) => g.label === NOT_RECORDED)?.visits, 1);
});

test('"Other" appointments and unfinished prenatal ones are not counted, only flagged', () => {
  const r = build([
    visit('adult', '2026-10-03', { label: 'Other' }),
    visit('adult', '2026-10-04', { status: 'missed' }),
    visit('adult', '2026-10-05', { status: 'upcoming' }),
    visit('adult', '2026-10-06', { status: 'cancelled' }),
    visit('adult', '2026-10-07', { doctorApproval: 'pending' }),
    visit('adult', '2026-10-08', { label: 'Ultrasound' }),
  ]);
  assert.equal(r.totals.visits, 1);
  assert.equal(r.dataQuality.otherAppointments, 1);
  assert.deepEqual(r.dataQuality.notCompleted, { upcoming: 1, missed: 1, cancelled: 1 });
  assert.equal(r.dataQuality.visitsNotApproved, 1);
});

test('empty month: real zeros for visits, every day present', () => {
  const r = build([], '2026-02');
  assert.equal(r.daily.length, 28);
  assert.equal(r.totals.visits, 0);
  assert.equal(r.totals.uniquePatients, 0);
  assert.ok(r.daily.every((d) => d.total === 0));
  assert.ok(r.noSourceRows.length > 0);
});

test('DOH split: 10-14, 15-19, 20-49, with "Other ages" only when needed', () => {
  const r = build([visit('teen', '2026-10-20'), visit('adult', '2026-10-20'), visit('nodob', '2026-10-20')], '2026-10', 'doh');
  assert.deepEqual(r.ageColumns, ['10-14', '15-19', '20-49', AGE_NOT_RECORDED]);
  assert.deepEqual(r.totals.visitsByAge, [0, 1, 1, 1]);
  const old = buildPrenatalReport({
    month: '2026-10', now: NOW, split: 'doh',
    appointments: [visit('old', '2026-10-02')],
    patients: [{ uid: 'old', name: 'Old', dob: '1970-01-01', dueDate: null }],
  });
  assert.deepEqual(old.ageColumns, ['10-14', '15-19', '20-49', OTHER_AGES, AGE_NOT_RECORDED]);
  assert.deepEqual(old.totals.visitsByAge, [0, 0, 0, 1, 0]);
});

test('gestational week and bands at the visit date', () => {
  assert.equal(gestationalWeekOn('2027-03-15', '2026-10-20'), 19);
  assert.equal(gestationalWeekOn('2026-10-20', '2026-10-20'), 40);
  assert.equal(gestationalWeekOn('2026-10-01', '2026-10-20'), 40);
  assert.equal(gestationalWeekOn(null, '2026-10-20'), null);
  const r = build([visit('adult', '2026-10-20'), visit('teen', '2026-10-20')]);
  assert.equal(r.gestation.find((g) => g.label === '14-20')?.visits, 1);
  assert.equal(r.gestation.find((g) => g.label === '31-34')?.visits, 1);
  // Under 8 weeks: due date about 36 weeks away.
  const early = buildPrenatalReport({
    month: '2026-10', now: NOW, appointments: [visit('e', '2026-10-01')],
    patients: [{ uid: 'e', name: 'E', dob: null, dueDate: '2027-06-10' }],
  });
  assert.equal(early.gestation.find((g) => g.label === UNDER_8)?.visits, 1);
});
