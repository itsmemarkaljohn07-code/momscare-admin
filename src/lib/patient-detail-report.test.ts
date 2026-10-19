// Run: node --import tsx --test src/lib/patient-detail-report.test.ts
// (run it under TZ=Asia/Manila and TZ=UTC: the answers must not change)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NOT_RECORDED, axisRange, buildPatientDetailReport, seriesPoints } from './patient-detail-report';

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
