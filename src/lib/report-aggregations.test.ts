// Run: node --import tsx --test src/lib/report-aggregations.test.ts
// (run it under TZ=Asia/Manila and TZ=UTC: the answers must not change)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAppointmentReport, cancellationRows, countStatuses, countsByDoctor, countsByMonth, inRange, manilaKey,
  rangeForPreset, reportStatus, validRange, type ReportAppointment,
} from './report-aggregations';

// Oct 19, 2026, 10:00 AM in Manila.
const NOW = new Date('2026-10-19T02:00:00Z');

const appt = (over: Partial<ReportAppointment>): ReportAppointment => ({
  patientName: 'Ana', label: 'Ultrasound', doctor: 'Dr. A', date: '2026-10-10', time: '9:00 AM',
  status: 'completed', cancellationState: null, ...over,
});

test('Manila calendar date for an instant', () => {
  assert.equal(manilaKey(new Date('2026-10-18T17:30:00Z')), '2026-10-19');
  assert.equal(manilaKey(NOW), '2026-10-19');
});

test('presets as Manila dates', () => {
  assert.deepEqual(rangeForPreset('this_month', '2026-10-19'), { from: '2026-10-01', to: '2026-10-31' });
  assert.deepEqual(rangeForPreset('last_month', '2026-10-19'), { from: '2026-09-01', to: '2026-09-30' });
  assert.deepEqual(rangeForPreset('last_month', '2026-01-15'), { from: '2025-12-01', to: '2025-12-31' });
  assert.deepEqual(rangeForPreset('last_month', '2026-03-31'), { from: '2026-02-01', to: '2026-02-28' });
  assert.deepEqual(rangeForPreset('last_30_days', '2026-10-19'), { from: '2026-09-20', to: '2026-10-19' });
  assert.deepEqual(rangeForPreset('all_time', '2026-10-19'), { from: null, to: null });
});

test('range checks: from <= to, inclusive ends', () => {
  assert.equal(validRange({ from: '2026-10-01', to: '2026-10-31' }), true);
  assert.equal(validRange({ from: '2026-11-01', to: '2026-10-31' }), false);
  assert.equal(validRange({ from: 'oct', to: null }), false);
  const r = { from: '2026-10-01', to: '2026-10-31' };
  assert.equal(inRange('2026-10-01', r), true);
  assert.equal(inRange('2026-10-31', r), true);
  assert.equal(inRange('2026-11-01', r), false);
  assert.equal(inRange('2026-09-30', r), false);
  assert.equal(inRange('2026-12-25', { from: null, to: null }), true);
  assert.equal(inRange('not-a-date', { from: null, to: null }), false);
});

test('status: still upcoming 3 hours after its start counts as missed', () => {
  assert.equal(reportStatus(appt({ status: 'upcoming', date: '2026-10-19', time: '6:59 AM' }), NOW), 'missed');
  assert.equal(reportStatus(appt({ status: 'upcoming', date: '2026-10-19', time: '7:01 AM' }), NOW), 'upcoming');
  assert.equal(reportStatus(appt({ status: 'missed' }), NOW), 'missed');
  assert.equal(reportStatus(appt({ status: 'cancelled' }), NOW), 'cancelled');
});

test('status counts, by month and by doctor', () => {
  const rows = [
    appt({}),
    appt({ status: 'cancelled', doctor: 'Dr. B' }),
    appt({ status: 'upcoming', date: '2026-11-02' }),
    appt({ status: 'upcoming', date: '2026-09-02', doctor: 'Dr. B' }),
  ];
  assert.deepEqual(countStatuses(rows, NOW), { total: 4, upcoming: 1, completed: 1, cancelled: 1, missed: 1 });
  assert.deepEqual(countsByMonth(rows, NOW).map((m) => [m.month, m.total]), [['2026-09', 1], ['2026-10', 2], ['2026-11', 1]]);
  const byDoctor = countsByDoctor(rows, NOW);
  assert.deepEqual(byDoctor.map((d) => [d.doctor, d.total, d.missed, d.cancelled]), [['Dr. A', 2, 0, 0], ['Dr. B', 2, 1, 1]]);
});

test('cancellation rows: decision labels, no reasons, newest first', () => {
  const rows = cancellationRows([
    appt({ cancellationState: 'approved', date: '2026-10-01' }),
    appt({ cancellationState: 'requested', date: '2026-10-05' }),
    appt({ cancellationState: null }),
  ]);
  assert.deepEqual(rows.map((r) => r.decision), ['Pending', 'Approved']);
  assert.deepEqual(Object.keys(rows[0]).sort(), ['date', 'decision', 'label', 'patientName']);
});

test('report applies the date range before counting', () => {
  const rep = buildAppointmentReport([appt({}), appt({ date: '2026-08-01' })], { from: '2026-10-01', to: '2026-10-31' }, NOW, false);
  assert.equal(rep.counts.total, 1);
  assert.equal(rep.capped, false);
});

// -- Patients ------------------------------------------------------------

import {
  buildPatientReport, countsByTrimester, dueKey, dueSoon, patientsByDoctor, patientsByDueMonth, type ReportPatient,
} from './report-aggregations';

const patient = (over: Partial<ReportPatient>): ReportPatient => ({ name: 'Ana', dueDate: null, disabled: false, doctors: [], ...over });
// Due date N days after NOW (Oct 19, 2026 Manila), stored the way the app stores it (ISO, Manila midnight).
const dueIn = (days: number) => new Date(Date.UTC(2026, 9, 18, 16, 0, 0) + days * 864e5).toISOString();

test('due date as a Manila calendar date', () => {
  assert.equal(dueKey('2027-03-14T16:00:00.000Z'), '2027-03-15');
  assert.equal(dueKey('2027-03-15'), '2027-03-15');
  assert.equal(dueKey(null), null);
  assert.equal(dueKey('nonsense'), null);
});

test('trimester buckets follow the dashboard week rule (0-13, 14-27, 28-40)', () => {
  // 280-day model: week = floor((280 - daysUntilDue) / 7).
  const rows = [
    patient({ dueDate: dueIn(280 - 13 * 7) }), // week 13 -> 1st
    patient({ dueDate: dueIn(280 - 14 * 7) }), // week 14 -> 2nd
    patient({ dueDate: dueIn(280 - 27 * 7) }), // week 27 -> 2nd
    patient({ dueDate: dueIn(280 - 28 * 7) }), // week 28 -> 3rd
    patient({ dueDate: dueIn(-10) }), // past due -> week 40 -> 3rd
    patient({ dueDate: null }),
  ];
  assert.deepEqual(countsByTrimester(rows, NOW).map((b) => b.count), [1, 2, 2, 1]);
});

test('patients by doctor, "Not assigned" for none, a doctor counted once per patient', () => {
  const rows = [patient({ doctors: ['Dr. A', 'Dr. A'] }), patient({ doctors: ['Dr. A', 'Dr. B'] }), patient({ doctors: [] })];
  assert.deepEqual(patientsByDoctor(rows), [{ label: 'Dr. A', count: 2 }, { label: 'Dr. B', count: 1 }, { label: 'Not assigned', count: 1 }]);
});

test('due months: earlier, next 12 months from this one, later only when any, no due date', () => {
  const rows = [
    patient({ dueDate: '2026-09-30' }),
    patient({ dueDate: '2026-10-31' }),
    patient({ dueDate: '2027-09-01' }),
    patient({ dueDate: '2027-10-01' }),
    patient({ dueDate: null }),
  ];
  const b = patientsByDueMonth(rows, '2026-10-19');
  assert.equal(b[0].label, 'Earlier');
  assert.equal(b[0].count, 1);
  assert.equal(b[1].month, '2026-10');
  assert.equal(b[1].count, 1);
  assert.equal(b[12].month, '2027-09');
  assert.equal(b[12].count, 1);
  assert.deepEqual(b.slice(13).map((x) => [x.label, x.count]), [['Later', 1], ['No due date', 1]]);
  assert.equal(patientsByDueMonth([patient({})], '2026-10-19').some((x) => x.label === 'Later'), false);
});

test('due in the next 60 days, soonest first, inclusive ends', () => {
  const rows = [
    patient({ name: 'Late', dueDate: '2026-12-18' }), // today + 60
    patient({ name: 'Soon', dueDate: '2026-10-19' }), // today
    patient({ name: 'Out', dueDate: '2026-12-19' }), // today + 61
    patient({ name: 'Past', dueDate: '2026-10-18' }),
  ];
  assert.deepEqual(dueSoon(rows, '2026-10-19', NOW).map((r) => r.name), ['Soon', 'Late']);
});

test('patient report summary', () => {
  const rep = buildPatientReport([patient({ dueDate: '2027-01-01' }), patient({ disabled: true })], NOW);
  assert.deepEqual(rep.summary, { total: 2, active: 1, suspended: 1, withDueDate: 1 });
  assert.equal(rep.asOf, '2026-10-19');
});
