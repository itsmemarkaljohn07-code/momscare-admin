// Run: node --import tsx --test src/lib/patient-detail-report.test.ts
// (run it under TZ=Asia/Manila and TZ=UTC: the answers must not change)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NOT_RECORDED, axisRange, buildPatientDetailReport, clinicCharts, clinicRows, clinicTrendCharts, seriesPoints } from './patient-detail-report';

const NOW = new Date('2026-10-19T02:00:00Z'); // Oct 19, 10:00 AM Manila
const profile = { fullName: 'Ana Cruz', username: null, email: 'a@x.test', clinicName: '', dueDate: '2027-03-14T16:00:00.000Z', firstTimeMom: null };
const appt = (date: string, status = 'completed') => ({ date, time: '9:00 AM', label: 'Ultrasound', type: 'Radiology', doctor: 'Dr. A', status, doctorApproval: 'approved' });
const snap = (createdAt: string, health: object | null = null) => ({ createdAt, type: 'bump', week: 20, caption: '', health });

test('profile: due date in Manila, week and trimester, missing values "Not recorded"', () => {
  const r = buildPatientDetailReport({ profile, appointments: [], snapshots: [], range: { from: null, to: null }, now: NOW });
  const v = Object.fromEntries(r.profile.map((p) => [p.label, p.value]));
  assert.equal(v['Due date'], '2027-03-15');
  assert.equal(v['Username'], NOT_RECORDED);
  assert.equal(v['Clinic'], NOT_RECORDED);
  assert.equal(v['First-time mom'], NOT_RECORDED);
  assert.match(v['Current week'], /^Week \d+$/);
  assert.equal(v['Trimester'], '2nd trimester');
});

test('period filters appointments by date and snapshots by Manila upload day', () => {
  const r = buildPatientDetailReport({
    profile,
    appointments: [appt('2026-09-30'), appt('2026-10-05'), appt('2026-10-06', 'cancelled')],
    // Oct 31 16:30 UTC is Nov 1 in Manila: outside October.
    snapshots: [snap('2026-10-10T01:00:00Z'), snap('2026-10-31T16:30:00Z')],
    range: { from: '2026-10-01', to: '2026-10-31' },
    now: NOW,
  });
  assert.equal(r.summary.appointments, 2);
  assert.equal(r.summary.completed, 1);
  assert.equal(r.summary.snapshots, 1);
  assert.deepEqual(r.appointments.map((a) => a.status), ['Completed', 'Cancelled']);
});

test('health rows oldest first; latest weight and BP; mood names', () => {
  const r = buildPatientDetailReport({
    profile,
    appointments: [],
    snapshots: [
      snap('2026-10-12T01:00:00Z', { weight: 61.2, bpSys: 118, bpDia: 76, kicks: 9, mood: 3 }),
      snap('2026-10-02T01:00:00Z', { weight: 60.5, bpSys: 'x', mood: 9 }),
    ],
    range: { from: null, to: null },
    now: NOW,
  });
  assert.deepEqual(r.health.map((h) => h.weight), [60.5, 61.2]);
  assert.equal(r.health[0].bpSys, null);
  assert.equal(r.health[0].mood, null);
  assert.equal(r.health[1].mood, 'Great');
  assert.equal(r.summary.latestWeight, '61.2 kg');
  assert.equal(r.summary.latestBp, '118/76');
});

test('nothing recorded', () => {
  const r = buildPatientDetailReport({ profile: { ...profile, dueDate: null }, appointments: [], snapshots: [], range: { from: null, to: null }, now: NOW });
  assert.equal(r.summary.latestWeight, NOT_RECORDED);
  assert.equal(r.summary.latestBp, NOT_RECORDED);
  assert.equal(r.profile.find((p) => p.label === 'Trimester')?.value, NOT_RECORDED);
});

test('chart helpers', () => {
  assert.deepEqual(seriesPoints([1, null, 3]), [{ i: 0, v: 1 }, { i: 2, v: 3 }]);
  assert.deepEqual(axisRange([60, 60]), [57, 63]);
  assert.deepEqual(axisRange([100, 120]), [98, 122]);
  assert.deepEqual(axisRange([]), [0, 1]);
});

const reading = (measuredOn: unknown, values: Record<string, unknown> = {}) => ({ measuredOn, enteredByName: 'Dr. A', ...values });

test('clinic readings: newest first, period boundaries inclusive on the Manila day', () => {
  const all = [reading('2026-10-31', { pulse: 80 }), reading('2026-10-01', { pulse: 81 }), reading('2026-09-30', { pulse: 82 }), reading('2026-11-01', { pulse: 83 }), reading('2026-10-15', { pulse: 84 })];
  const r = clinicRows(all, { from: '2026-10-01', to: '2026-10-31' });
  assert.deepEqual(r.map((x) => x.date), ['2026-10-31', '2026-10-15', '2026-10-01']); // the day before and after are out
  assert.equal(clinicRows(all, { from: null, to: null }).length, 5);
  assert.deepEqual(clinicRows(all, { from: '2026-11-01', to: null }).map((x) => x.date), ['2026-11-01']);
  assert.deepEqual(clinicRows(all, { from: null, to: '2026-09-30' }).map((x) => x.date), ['2026-09-30']);
  // Through the report builder, with the period of the rest of the report.
  const rep = buildPatientDetailReport({ profile, appointments: [], snapshots: [], clinicReadings: all, range: { from: '2026-10-01', to: '2026-10-31' }, now: NOW });
  assert.equal(rep.clinic.length, 3);
});

test('clinic readings: nulls, old documents, malformed values and dates are tolerated', () => {
  const r = clinicRows([
    reading('2026-10-20', { weightKg: 60.1, bpSys: 112, bpDia: 72 }), // old style: no newer fields
    reading('2026-10-21', { weightKg: '60', bpSys: 120, pulse: Number.NaN, temperatureC: Infinity, fundalHeightCm: null }),
    reading('2026-02-30', { pulse: 80 }), // not a real day
    reading('2026/10/22', { pulse: 80 }),
    reading(20261023, { pulse: 80 }),
    reading(undefined, { pulse: 80 }),
    { measuredOn: '2026-10-24', pulse: 90 }, // no enteredByName
  ], { from: null, to: null });
  assert.deepEqual(r.map((x) => x.date), ['2026-10-24', '2026-10-21', '2026-10-20']);
  const old = r.find((x) => x.date === '2026-10-20')!;
  assert.deepEqual([old.weightKg, old.bpSys, old.bpDia, old.fundalHeightCm, old.fetalHeartRate, old.pulse, old.temperatureC], [60.1, 112, 72, null, null, null, null]);
  const odd = r.find((x) => x.date === '2026-10-21')!;
  assert.deepEqual([odd.weightKg, odd.bpSys, odd.bpDia, odd.pulse, odd.temperatureC], [null, null, null, null, null]); // half a BP is no BP
  assert.equal(r[0].enteredBy, NOT_RECORDED);
});

test('clinic charts: 2+ points drawn, 1 point replaced, never-taken left out; clinic points only', () => {
  const rows = clinicRows([
    reading('2026-11-03', { weightKg: 62.4, bpSys: 120, bpDia: 80, fundalHeightCm: 28.5, fetalHeartRate: 142, pulse: 84, temperatureC: 36.8 }),
    reading('2026-11-05', { pulse: 88 }),
    reading('2026-10-20', { weightKg: 60.1, bpSys: 112, bpDia: 72 }),
  ], { from: null, to: null });
  const charts = clinicCharts(rows);
  const byTitle = Object.fromEntries(charts.map((c) => [c.title, c]));
  assert.deepEqual(Object.keys(byTitle), ['Weight', 'Blood pressure', 'Fundal height', 'Fetal heart rate', 'Pulse', 'Temperature']);
  const weight = byTitle.Weight as { days: string[]; series: { values: number[] }[] };
  assert.deepEqual(weight.days, ['2026-10-20', '2026-11-03']); // oldest first
  assert.deepEqual(weight.series[0].values, [60.1, 62.4]);
  const bp = byTitle['Blood pressure'] as { series: { label: string; values: number[] }[] };
  assert.deepEqual(bp.series.map((s) => [s.label, s.values]), [['Systolic', [112, 120]], ['Diastolic', [72, 80]]]);
  assert.deepEqual((byTitle.Pulse as { series: { values: number[] }[] }).series[0].values, [84, 88]);
  for (const one of ['Fundal height', 'Fetal heart rate', 'Temperature']) assert.ok('few' in byTitle[one], one);
  // Only weight taken: no other chart at all.
  assert.deepEqual(clinicCharts(clinicRows([reading('2026-10-01', { weightKg: 60 }), reading('2026-10-02', { weightKg: 61 })], { from: null, to: null })).map((c) => c.title), ['Weight']);
  assert.deepEqual(clinicCharts([]), []);
});

test('an empty period, and 500 readings without an error', () => {
  const rep = buildPatientDetailReport({ profile, appointments: [], snapshots: [], clinicReadings: [reading('2026-08-10', { pulse: 80 })], range: { from: '2026-10-01', to: '2026-10-31' }, now: NOW });
  assert.deepEqual(rep.clinic, []);
  assert.equal(buildPatientDetailReport({ profile, appointments: [], snapshots: [], range: { from: null, to: null }, now: NOW }).clinic.length, 0);
  const many = Array.from({ length: 500 }, (_, i) => {
    const d = new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10);
    return reading(d, { weightKg: 50 + (i % 30) / 10, bpSys: 100 + (i % 20), bpDia: 60 + (i % 15), pulse: 70 + (i % 10) });
  });
  const rows = clinicRows(many, { from: null, to: null });
  assert.equal(rows.length, 500);
  assert.equal(rows[0].date, '2026-05-15');
  assert.equal(clinicCharts(rows).length, 3);
});

test('admin trend charts: 2+ points only, oldest first, clinic points only, 500 readings', () => {
  assert.deepEqual(clinicTrendCharts([]), []);
  assert.deepEqual(clinicTrendCharts([reading('2026-11-01', { pulse: 80 })]), []); // 1 point: no chart
  const two = clinicTrendCharts([reading('2026-11-03', { pulse: 84 }), reading('2026-11-01', { pulse: 80 })]);
  assert.deepEqual(two.map((c) => [c.title, c.days, c.series[0].values]), [['Pulse', ['2026-11-01', '2026-11-03'], [80, 84]]]);
  const mixed = clinicTrendCharts([
    reading('2026-10-06', { weightKg: 60.2, bpSys: 112, bpDia: 72, fundalHeightCm: 24.5 }),
    reading('2026-11-03', { weightKg: 62.4, bpSys: 120, bpDia: 80 }),
    reading('2026-11-05', { pulse: 88, temperatureC: 'x' }),
  ]);
  assert.deepEqual(mixed.map((c) => c.title), ['Weight', 'Blood pressure']); // fundal 1 point, pulse 1 point
  const many = Array.from({ length: 500 }, (_, i) => reading(new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10), { weightKg: 50 + (i % 30) / 10, pulse: 70 + (i % 10) }));
  const charts = clinicTrendCharts(many);
  assert.deepEqual(charts.map((c) => [c.title, c.days.length]), [['Weight', 500], ['Pulse', 500]]);
  assert.equal(charts[0].days[0], '2025-01-01');
});
