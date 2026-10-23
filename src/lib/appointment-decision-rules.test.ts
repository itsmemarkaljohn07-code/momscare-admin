// Run: node --import tsx --test src/lib/appointment-decision-rules.test.ts
// (run it under TZ=Asia/Manila and TZ=UTC: the answers must not change)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DECLINE_REASON_MAX, NO_LONGER_DECIDABLE, adminDecisionBlock, cleanDeclineReason, clinicDecisionMessage,
  clinicDecisionNoticeId, onBehalfOf, parseDecision, patientDecisionNotice,
} from './appointment-decision-rules';

// Oct 23, 10:00 AM Manila.
const NOW = new Date('2026-10-23T02:00:00Z');
const appt = (over: object = {}) => ({ status: 'upcoming', date: '2026-10-23', time: '2:00 PM', doctor: 'Dr. Reyes', doctorApproval: 'pending', ...over });

test('can decide: upcoming, pending, not yet missed', () => {
  assert.equal(adminDecisionBlock(appt(), NOW), null);
  // Started an hour ago: still within the 3-hour window.
  assert.equal(adminDecisionBlock(appt({ time: '9:00 AM' }), NOW), null);
});

test('closed, missed or unreadable appointments can no longer be decided', () => {
  for (const status of ['completed', 'cancelled', 'missed']) {
    assert.equal(adminDecisionBlock(appt({ status }), NOW), NO_LONGER_DECIDABLE);
  }
  // 6:59 AM Manila start + 3 hours = 9:59 AM: missed at 10:00 AM.
  assert.equal(adminDecisionBlock(appt({ time: '6:59 AM' }), NOW), NO_LONGER_DECIDABLE);
  assert.equal(adminDecisionBlock(appt({ date: '2026-10-21', time: '' }), NOW), NO_LONGER_DECIDABLE);
  assert.equal(adminDecisionBlock(appt({ doctorApproval: 'weird' }), NOW), NO_LONGER_DECIDABLE);
});

test('already decided: names the doctor, or the clinic when an admin decided', () => {
  assert.equal(adminDecisionBlock(appt({ doctorApproval: 'approved' }), NOW), 'Dr. Reyes already approved this appointment.');
  assert.equal(adminDecisionBlock(appt({ doctorApproval: 'rejected' }), NOW), 'Dr. Reyes already declined this appointment.');
  assert.equal(
    adminDecisionBlock(appt({ doctorApproval: 'approved', decidedBy: { role: 'admin', uid: 'a1' } }), NOW),
    'The clinic already approved this appointment.'
  );
  assert.equal(adminDecisionBlock(appt({ doctorApproval: 'approved', doctor: '' }), NOW), 'The doctor already approved this appointment.');
});

test('decline reason: plain text, trimmed, capped', () => {
  assert.equal(cleanDeclineReason('  Doctor is away \u0007 '), 'Doctor is away');
  assert.equal(cleanDeclineReason(undefined), '');
  assert.equal(cleanDeclineReason(42), '');
  assert.equal(cleanDeclineReason('line one\nline two'), 'line one\nline two');
  assert.equal(cleanDeclineReason('x'.repeat(DECLINE_REASON_MAX + 50)).length, DECLINE_REASON_MAX);
});

test('decision parsing', () => {
  assert.equal(parseDecision('approve'), 'approved');
  assert.equal(parseDecision('decline'), 'rejected');
  assert.equal(parseDecision('approved'), null);
});

test('patient notice keeps the doctor route wording and id', () => {
  const ok = patientDecisionNotice({ appointmentId: 'A1', decision: 'approved', doctorName: 'Dr. Reyes', label: 'Ultrasound', date: '2026-10-23', time: '2:00 PM', changedAtMs: 123 });
  assert.equal(ok.bellMessage, 'Dr. Reyes approved your Ultrasound appointment on 2026-10-23 at 2:00 PM.');
  assert.equal(ok.id, 'appointment_A1_approved_123');
  assert.equal(ok.type, 'appointment_approved');
  const no = patientDecisionNotice({ appointmentId: 'A1', decision: 'rejected', doctorName: 'Dr. Reyes', label: 'Booking Appointment', date: 'd', time: 't', reason: 'Away', changedAtMs: 9 });
  assert.equal(no.bellMessage, 'Dr. Reyes declined your Booking Appointment. Reason: Away');
  assert.equal(no.id, 'appointment_A1_rejected_9');
  assert.ok(!no.pushBody.includes('Away'));
});

test('doctor bell line, id and audit details', () => {
  assert.equal(
    clinicDecisionMessage({ decision: 'approved', label: 'Ultrasound', patientName: 'Ana', date: '2026-10-23', time: '2:00 PM' }),
    'The clinic approved Ultrasound appointment for Ana on 2026-10-23 at 2:00 PM on your behalf.'
  );
  assert.equal(clinicDecisionNoticeId('A1', 'rejected'), 'clinic-decision-A1-rejected');
  assert.equal(onBehalfOf('Dr. Reyes'), 'On behalf of Dr. Reyes');
  assert.equal(onBehalfOf(''), 'On behalf of the doctor');
});
