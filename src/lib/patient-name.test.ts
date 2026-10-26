// Run: node --import tsx --test src/lib/patient-name.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchesName, patientName, patientNameParts } from './patient-name';

test('parts with a middle name', () => {
  assert.deepEqual(patientNameParts({ firstName: 'Ana', middleName: 'Reyes', lastName: 'Cruz', fullName: 'Ana Reyes Cruz' }),
    { first: 'Ana', middle: 'Reyes', last: 'Cruz', full: 'Ana Reyes Cruz' });
});

test('parts without a middle name', () => {
  assert.deepEqual(patientNameParts({ firstName: 'Ana', lastName: 'Cruz' }), { first: 'Ana', middle: '', last: 'Cruz', full: 'Ana Cruz' });
  assert.deepEqual(patientNameParts({ firstName: 'Ana', middleName: '', lastName: 'Cruz', fullName: 'Ana Cruz' }).full, 'Ana Cruz');
});

test('some parts missing: never "undefined" or "null"', () => {
  assert.equal(patientNameParts({ firstName: 'Ana', middleName: null, lastName: undefined }).full, 'Ana');
  assert.equal(patientNameParts({ lastName: 'Cruz' }).full, 'Cruz');
  assert.ok(!/undefined|null/.test(patientNameParts({ firstName: 'Ana', middleName: null }).full));
});

test('only fullName (older accounts): first word, then the rest', () => {
  assert.deepEqual(patientNameParts({ fullName: 'Maria Clara de la Cruz' }), { first: 'Maria', middle: '', last: 'Clara de la Cruz', full: 'Maria Clara de la Cruz' });
  assert.deepEqual(patientNameParts({ fullName: 'Ana' }), { first: 'Ana', middle: '', last: '', full: 'Ana' });
});

test('extra spaces, empty values and nulls', () => {
  assert.equal(patientNameParts({ firstName: '  Ana ', middleName: ' Reyes  ', lastName: ' Cruz ' }).full, 'Ana Reyes Cruz');
  assert.equal(patientNameParts({ fullName: '  Ana    Cruz  ' }).full, 'Ana Cruz');
  assert.deepEqual(patientNameParts(null), { first: '', middle: '', last: '', full: '' });
  assert.deepEqual(patientNameParts({ fullName: '   ' }), { first: '', middle: '', last: '', full: '' });
  assert.equal(patientName({ fullName: 42 }, 'Patient'), 'Patient');
  assert.equal(patientName({ firstName: 'Ana', lastName: 'Cruz' }, 'Patient'), 'Ana Cruz');
});

test('search by each part, any case, extra spaces ignored', () => {
  const p = patientNameParts({ firstName: 'Ana', middleName: 'Reyes', lastName: 'Dela Cruz' });
  for (const q of ['ana', 'REYES', 'dela cruz', '  cruz  ', 'ana  cruz', 'Ana Reyes Dela Cruz', '']) assert.ok(matchesName(p, q), q);
  assert.ok(!matchesName(p, 'maria'));
  assert.ok(!matchesName(p, 'ana maria'));
  assert.ok(matchesName(patientNameParts({ fullName: 'Liza Bautista' }), 'bautista'));
});
