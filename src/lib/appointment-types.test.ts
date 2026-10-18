// Run: node --import tsx --test src/lib/appointment-types.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { doctorFitsAppointment, isCustomSpecialty } from './appointment-types';
import { cleanSpecialty } from './doctor-specialty';

test('listed specialties follow the name -> specialty table', () => {
  assert.equal(doctorFitsAppointment('Ultrasound', 'Radiology'), true);
  assert.equal(doctorFitsAppointment('Ultrasound', 'Laboratory'), false);
  assert.equal(doctorFitsAppointment('Other', 'Cardiology'), true);
});

test('a custom specialty only takes "Other" appointments', () => {
  assert.equal(isCustomSpecialty('Perinatology'), true);
  assert.equal(isCustomSpecialty('OB-GYN'), false);
  assert.equal(doctorFitsAppointment('Other', 'Perinatology'), true);
  assert.equal(doctorFitsAppointment('Ultrasound', 'Perinatology'), false);
  assert.equal(doctorFitsAppointment('Prenatal Checkup', 'Perinatology'), false);
});

test('server specialty check: trimmed, 2 to 40 characters', () => {
  assert.equal(cleanSpecialty('  Perinatology  '), 'Perinatology');
  assert.equal(cleanSpecialty('Maternal   Fetal'), 'Maternal Fetal');
  assert.equal(cleanSpecialty('X'), null);
  assert.equal(cleanSpecialty('x'.repeat(41)), null);
  assert.equal(cleanSpecialty(''), null);
  assert.equal(cleanSpecialty(42), null);
});
