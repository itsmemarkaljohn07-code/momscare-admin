// Run: node --import tsx --test src/lib/appointment-cancelled-rules.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CANCELLED_PUSH_BODY, cancelledBellMessage, cancelledNoticeId } from './appointment-cancelled-rules';

test('one fixed id per appointment, whichever path cancels it', () => {
  assert.equal(cancelledNoticeId('a1'), 'cancelled_a1');
});

test('bell text names who cancelled it', () => {
  assert.equal(
    cancelledBellMessage('Ultrasound', '2030-02-03', '9:00 AM', 'clinic'),
    'Your Ultrasound appointment on Feb 3, 2030 at 9:00 AM was cancelled by the clinic.'
  );
  assert.match(cancelledBellMessage('Prenatal Checkup', '2030-02-03', '9:00 AM', 'doctor'), /cancelled by your doctor\.$/);
  assert.match(cancelledBellMessage('Booking Appointment', '2030-02-03', '9:00 AM', 'request'), /^Your Booking Appointment on .* was cancelled at your request\.$/);
  assert.equal(cancelledBellMessage(undefined, '', '', 'clinic'), 'Your appointment was cancelled by the clinic.');
});

test('push text is generic', () => {
  assert.doesNotMatch(CANCELLED_PUSH_BODY, /\d|Ultrasound|Checkup/);
});
