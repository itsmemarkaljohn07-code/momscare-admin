// Run: node --import tsx --test src/lib/patient-profile-fields.test.ts
// (run it under TZ=Asia/Manila and TZ=UTC: the answers must not change)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ageLabel, ageOnDate, ageToday, formatAddress, formatBirthday, readAddress } from './patient-profile-fields';

test('address: the app map, trimmed, in order street, barangay, city, province', () => {
  const a = readAddress({ province: ' Samar ', city: 'Calbayog City', barangay: ' Brgy  One ', street: 'Purok 1' });
  assert.deepEqual(a, { province: 'Samar', city: 'Calbayog City', barangay: 'Brgy One', street: 'Purok 1' });
  assert.equal(formatAddress(a), 'Purok 1, Brgy One, Calbayog City, Samar');
});

test('address: partial map keeps only the filled parts', () => {
  assert.equal(formatAddress(readAddress({ province: 'Samar', city: '', barangay: 'Brgy One', street: '' })), 'Brgy One, Samar');
  assert.equal(formatAddress(readAddress({ city: 'Calbayog City' })), 'Calbayog City');
  assert.equal(formatAddress(readAddress({ city: 42, street: null })), null);
});

test('address: an older plain string is the street line', () => {
  assert.deepEqual(readAddress('  Old street, somewhere  '), { province: '', city: '', barangay: '', street: 'Old street, somewhere' });
  assert.equal(formatAddress(readAddress('  Old street  ')), 'Old street');
});

test('address: empty or missing is null', () => {
  assert.equal(readAddress(''), null);
  assert.equal(readAddress('   '), null);
  assert.equal(readAddress({ province: '', city: ' ', barangay: '', street: '' }), null);
  assert.equal(readAddress(undefined), null);
  assert.equal(readAddress(null), null);
  assert.equal(readAddress(7), null);
  assert.equal(formatAddress(null), null);
});

test('birthday today, tomorrow, yesterday (Manila date)', () => {
  // Oct 24, 2026, 7:30 AM in Manila (still Oct 23 in UTC).
  const now = new Date('2026-10-23T23:30:00Z');
  assert.equal(ageToday('2000-10-24', now), 26); // today
  assert.equal(ageToday('2000-10-25', now), 25); // tomorrow
  assert.equal(ageToday('2000-10-23', now), 26); // yesterday
});

test('29 February birthday', () => {
  assert.equal(ageOnDate('2004-02-29', '2026-02-28'), 21);
  assert.equal(ageOnDate('2004-02-29', '2026-03-01'), 22);
  assert.equal(ageOnDate('2004-02-29', '2028-02-29'), 24);
});

test('stored birthday forms: plain, ISO, empty, missing', () => {
  assert.equal(ageOnDate('1996-05-01', '2026-10-24'), 30);
  // The app's older ISO form: local midnight May 1 in Manila.
  assert.equal(ageOnDate('1996-04-30T16:00:00.000Z', '2026-05-01'), 30);
  assert.equal(formatBirthday('1996-04-30T16:00:00.000Z'), 'May 1, 1996');
  assert.equal(ageOnDate('', '2026-10-24'), null);
  assert.equal(ageOnDate(undefined, '2026-10-24'), null);
  assert.equal(ageOnDate(null, '2026-10-24'), null);
  assert.equal(ageOnDate('2030-01-01', '2026-10-24'), null);
  assert.equal(formatBirthday(''), null);
  assert.equal(ageLabel(27), '27 y/o');
  assert.equal(ageLabel(null), null);
});
