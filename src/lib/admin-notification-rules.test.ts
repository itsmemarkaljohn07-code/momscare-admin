// Run: node --import tsx --test src/lib/admin-notification-rules.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  NOTIFICATION_TTL_MS,
  appointmentRequestNotification,
  cancellationRequestNotification,
  doctorDecisionNotification,
  withinWindow,
} from './admin-notification-rules';

const base = { patientUid: 'uid1', patientName: 'Ana Cruz', appointmentLabel: 'Prenatal Checkup', date: '2026-10-20', time: '9:00 AM' };

test('request: fixed id, type, first slot, no reason or notes', () => {
  const n = appointmentRequestNotification({
    patientUid: 'uid1', requestId: 'r1', patientName: 'Ana Cruz', type: 'Ultrasound',
    options: [{ date: '2026-10-21', from: '09:00', to: '09:30' }],
  });
  assert.equal(n.id, 'req_uid1_r1');
  assert.equal(n.type, 'appointment_request');
  assert.equal(n.message, 'Ana Cruz requested a Ultrasound for 2026-10-21, 09:00–09:30.');
  assert.equal(n.link, '/admin/appointments?tab=requests');
});

test('request without a usable slot still reads well', () => {
  const n = appointmentRequestNotification({ patientUid: 'u', requestId: 'r', patientName: 'A patient', type: '', options: [] });
  assert.equal(n.message, 'A patient requested a appointment.');
});

test('decision: one id per change, approve and decline differ', () => {
  const a = doctorDecisionNotification({ ...base, appointmentId: 'a1', decision: 'approved', decidedAtMs: 1000, doctorName: 'Dr. Reyes' });
  const d = doctorDecisionNotification({ ...base, appointmentId: 'a1', decision: 'rejected', decidedAtMs: 2000, doctorName: 'Dr. Reyes' });
  assert.equal(a.id, 'appr_uid1_a1_1000');
  assert.equal(d.id, 'decl_uid1_a1_2000');
  assert.equal(a.type, 'doctor_approved');
  assert.equal(d.type, 'doctor_declined');
  assert.match(d.message, /^Dr\. Reyes declined Ana Cruz's Prenatal Checkup on 2026-10-20 at 9:00 AM\.$/);
});

test('same decision at the same moment gives the same id (no duplicates)', () => {
  const x = doctorDecisionNotification({ ...base, appointmentId: 'a1', decision: 'approved', decidedAtMs: 5, doctorName: 'D' });
  const y = doctorDecisionNotification({ ...base, appointmentId: 'a1', decision: 'approved', decidedAtMs: 5, doctorName: 'D' });
  assert.equal(x.id, y.id);
});

test('cancellation: id carries the request time, so a new request is a new entry', () => {
  const one = cancellationRequestNotification({ ...base, appointmentId: 'a1', requestedAtMs: 10 });
  const two = cancellationRequestNotification({ ...base, appointmentId: 'a1', requestedAtMs: 20 });
  assert.equal(one.id, 'cxl_uid1_a1_10');
  assert.notEqual(one.id, two.id);
  assert.equal(one.message, 'Ana Cruz asked to cancel the Prenatal Checkup on 2026-10-20 at 9:00 AM.');
});

test('ids never contain a slash', () => {
  const n = appointmentRequestNotification({ patientUid: 'a/b', requestId: 'c/d', patientName: 'x', type: 't', options: [] });
  assert.ok(!n.id.includes('/'));
});

test('7-day window', () => {
  const now = 10 * NOTIFICATION_TTL_MS;
  assert.equal(withinWindow(now - NOTIFICATION_TTL_MS + 1, now), true);
  assert.equal(withinWindow(now - NOTIFICATION_TTL_MS - 1, now), false);
  assert.equal(withinWindow(null, now), false);
});
