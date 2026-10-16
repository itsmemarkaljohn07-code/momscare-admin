// Run: node --import tsx --test src/lib/doctor-appointment-notice.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  appointmentNoticeId,
  appointmentNoticeMessage,
  resolveAppointmentDoctor,
} from './doctor-appointment-notice';

const doctors = [
  { id: 'doc-1', name: 'Dr. Inego Osit' },
  { id: 'doc-2', name: 'Dr. Maria Santos' },
  { id: 'doc-3', name: 'Dr. Same Name' },
  { id: 'doc-4', name: 'Dr. Same Name' },
];

test('matches by id when the request has one', () => {
  assert.deepEqual(resolveAppointmentDoctor(doctors, { doctorId: 'doc-2', doctorName: 'Dr. Inego Osit' }), doctors[1]);
});

test('an id that matches no doctor notifies nobody (no fallback to the name)', () => {
  assert.equal(resolveAppointmentDoctor(doctors, { doctorId: 'nope', doctorName: 'Dr. Inego Osit' }), null);
});

test('matches by exact name when there is no id', () => {
  assert.deepEqual(resolveAppointmentDoctor(doctors, { doctorName: 'Dr. Inego Osit' }), doctors[0]);
});

test('no match: unknown name, different case, or empty', () => {
  assert.equal(resolveAppointmentDoctor(doctors, { doctorName: 'Dr. Nobody' }), null);
  assert.equal(resolveAppointmentDoctor(doctors, { doctorName: 'dr. inego osit' }), null);
  assert.equal(resolveAppointmentDoctor(doctors, { doctorName: '' }), null);
  assert.equal(resolveAppointmentDoctor(doctors, {}), null);
});

test('two doctors with the same name: nobody is notified', () => {
  assert.equal(resolveAppointmentDoctor(doctors, { doctorName: 'Dr. Same Name' }), null);
});

test('duplicate: the same appointment always gives the same entry id', () => {
  assert.equal(appointmentNoticeId('abc123'), 'appointment-abc123');
  assert.equal(appointmentNoticeId('abc123'), appointmentNoticeId('abc123'));
});

test('message has only name, date and time', () => {
  assert.equal(
    appointmentNoticeMessage('Mikyla Test', '2026-10-20', '10:00 AM'),
    'Mikyla Test: 2026-10-20 at 10:00 AM. Open My Appointments to approve or decline.'
  );
});
