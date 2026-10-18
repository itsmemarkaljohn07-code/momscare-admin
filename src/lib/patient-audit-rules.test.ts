// Run: node --import tsx --test src/lib/patient-audit-rules.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PATIENT_AUDIT_WINDOW_MS, cancellationAuditEvents, requestAuditEvents } from './patient-audit-rules';

const NOW = Date.UTC(2030, 0, 10);
const options = [{ date: '2030-01-20', from: '09:00', to: '09:30' }];

test('a new request: one create event with a fixed id, no reason in the label', () => {
  const ev = requestAuditEvents('u1', 'r1', { type: 'Ultrasound', options, status: 'pending', createdAt: NOW - 1000, withdrawnAt: null }, NOW);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].id, 'patient_request_create_u1_r1');
  assert.equal(ev[0].action, 'appointment_request.create');
  assert.equal(ev[0].actorUid, 'u1');
  assert.equal(ev[0].targetLabel, 'Ultrasound request — 2030-01-20 09:00–09:30');
  assert.equal(ev[0].at, NOW - 1000);
});

test('a withdrawn request: create + withdraw', () => {
  const ev = requestAuditEvents('u1', 'r1', { type: 'Ultrasound', options, status: 'withdrawn', createdAt: NOW - 5000, withdrawnAt: NOW - 1000 }, NOW);
  assert.deepEqual(ev.map((e) => e.action), ['appointment_request.create', 'appointment_request.withdraw']);
  assert.equal(ev[1].id, 'patient_request_withdraw_u1_r1');
});

test('older than 7 days: nothing', () => {
  const old = NOW - PATIENT_AUDIT_WINDOW_MS - 1;
  assert.equal(requestAuditEvents('u1', 'r1', { type: 'X', options, status: 'withdrawn', createdAt: old, withdrawnAt: old }, NOW).length, 0);
  assert.equal(cancellationAuditEvents('u1', 'a1', { label: 'X', date: 'd', time: 't', state: 'requested', requestedAt: old }, NOW).length, 0);
});

test('cancellation: requested (also after a decision) vs withdrawn, id includes the time', () => {
  const appt = { label: 'Ultrasound appointment', date: '2030-02-01', time: '9:00 AM', requestedAt: NOW - 2000 };
  for (const state of ['requested', 'approved', 'declined']) {
    const [e] = cancellationAuditEvents('u1', 'a1', { ...appt, state }, NOW);
    assert.equal(e.action, 'appointment.cancel_request');
    assert.equal(e.id, `patient_cancel_request_u1_a1_${NOW - 2000}`);
    assert.equal(e.targetLabel, 'Ultrasound appointment — 2030-02-01 9:00 AM');
  }
  const [w] = cancellationAuditEvents('u1', 'a1', { ...appt, state: 'withdrawn' }, NOW);
  assert.equal(w.action, 'appointment.cancel_withdraw');
  assert.equal(cancellationAuditEvents('u1', 'a1', { ...appt, state: undefined }, NOW).length, 0);
});
