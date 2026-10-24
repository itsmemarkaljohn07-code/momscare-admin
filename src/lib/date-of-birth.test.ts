// Run: node --import tsx --test src/lib/date-of-birth.test.ts
// (run it under TZ=Asia/Manila and TZ=UTC: the answers must not change)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ageOn, dobKey, isRealDate, validateDob } from './date-of-birth';

const TODAY = '2026-10-24';

test('age in full years, birthday boundaries', () => {
  assert.equal(ageOn('2000-10-24', TODAY), 26);
  assert.equal(ageOn('2000-10-25', TODAY), 25);
  assert.equal(ageOn('2008-02-29', '2026-02-28'), 17);
  assert.equal(ageOn('2008-02-29', '2026-03-01'), 18);
  assert.equal(ageOn('bad', TODAY), null);
});

test('real dates only', () => {
  assert.ok(isRealDate('2024-02-29'));
  assert.ok(!isRealDate('2026-02-29'));
  assert.ok(!isRealDate('2026-13-01'));
  assert.ok(!isRealDate('2026-1-01'));
});

test('validation: future, age 10 to 60 today', () => {
  assert.deepEqual(validateDob('1996-05-01', TODAY), { ok: true, dob: '1996-05-01' });
  assert.equal(validateDob('2026-10-25', TODAY).ok, false);
  assert.equal(validateDob('2016-10-24', TODAY).ok, true); // exactly 10
  assert.equal(validateDob('2016-10-25', TODAY).ok, false); // 9
  assert.equal(validateDob('1966-10-25', TODAY).ok, true); // 59
  assert.equal(validateDob('1966-10-24', TODAY).ok, true); // exactly 60
  assert.equal(validateDob('1965-10-24', TODAY).ok, false); // 61
  assert.equal(validateDob('', TODAY).ok, false);
  assert.equal(validateDob(19960501, TODAY).ok, false);
});

test('stored values: plain date or the app ISO timestamp, as a Manila date', () => {
  assert.equal(dobKey('1996-05-01'), '1996-05-01');
  // Local midnight May 1 in Manila, as the app stores ISO timestamps.
  assert.equal(dobKey('1996-04-30T16:00:00.000Z'), '1996-05-01');
  assert.equal(dobKey(''), null);
  assert.equal(dobKey(null), null);
  assert.equal(dobKey('nonsense'), null);
});
