// Run: node --import tsx --test src/lib/appointment-status.test.ts
// (run it under TZ=Asia/Manila and TZ=UTC: the answers must not change)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MISSED_AFTER_MS, isMissedAppointment } from './appointment-status';

// Appointment times are Philippine time (UTC+8), whatever the machine's zone.
const at = (iso: string) => new Date(iso);
const appt = (date: string, time: string, status = 'upcoming') => ({ date, time, status });

test('threshold is 3 hours', () => {
  assert.equal(MISSED_AFTER_MS, 3 * 60 * 60 * 1000);
});

test('2h59m after start: not missed', () => {
  assert.equal(isMissedAppointment(appt('2026-10-14', '9:00 AM'), at('2026-10-14T11:59:00+08:00')), false);
});

test('3h00m after start: missed', () => {
  assert.equal(isMissedAppointment(appt('2026-10-14', '9:00 AM'), at('2026-10-14T12:00:00+08:00')), true);
});

test('before start and during the first 3 hours: not missed', () => {
  assert.equal(isMissedAppointment(appt('2026-10-14', '9:00 AM'), at('2026-10-14T08:00:00+08:00')), false);
  assert.equal(isMissedAppointment(appt('2026-10-14', '9:00 AM'), at('2026-10-14T09:30:00+08:00')), false);
});

test('across midnight (Philippine time): 11:00 PM start is missed at 2:00 AM next day', () => {
  const late = appt('2026-10-14', '11:00 PM');
  assert.equal(isMissedAppointment(late, at('2026-10-15T01:59:00+08:00')), false);
  assert.equal(isMissedAppointment(late, at('2026-10-15T02:00:00+08:00')), true);
});

test('12:00 PM and 12:00 AM are read correctly', () => {
  assert.equal(isMissedAppointment(appt('2026-10-14', '12:00 PM'), at('2026-10-14T14:59:00+08:00')), false);
  assert.equal(isMissedAppointment(appt('2026-10-14', '12:00 PM'), at('2026-10-14T15:00:00+08:00')), true);
  assert.equal(isMissedAppointment(appt('2026-10-14', '12:00 AM'), at('2026-10-14T03:00:00+08:00')), true);
});

test('cancelled and completed are never missed; stored missed stays missed', () => {
  const later = at('2026-10-20T00:00:00+08:00');
  assert.equal(isMissedAppointment(appt('2026-10-14', '9:00 AM', 'cancelled'), later), false);
  assert.equal(isMissedAppointment(appt('2026-10-14', '9:00 AM', 'completed'), later), false);
  assert.equal(isMissedAppointment(appt('2026-10-14', '9:00 AM', 'missed'), at('2026-10-14T09:01:00+08:00')), true);
});

test('unreadable time: missed only once its day has passed', () => {
  const noTime = appt('2026-10-14', '');
  assert.equal(isMissedAppointment(noTime, at('2026-10-14T23:59:00+08:00')), false);
  assert.equal(isMissedAppointment(noTime, at('2026-10-15T00:00:00+08:00')), true);
});
