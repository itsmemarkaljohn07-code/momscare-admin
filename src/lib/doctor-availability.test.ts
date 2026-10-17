// Run: node --import tsx --test src/lib/doctor-availability.test.ts
// (run it under TZ=Asia/Manila and TZ=UTC: the answers must not change)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { availableSlots, clinicNow, hhmmTo12h, slotLockId, timeToMinutes, weekdayOf } from './doctor-availability';

// Mon/Wed/Fri, 9:00–11:00, 30-minute slots.
const schedule = { workingDays: [1, 3, 5], startTime: '09:00', endTime: '11:00', slotMinutes: 30 };
const MONDAY = '2030-01-07';
const TUESDAY = '2030-01-08';
// Long before the test dates, so nothing counts as past.
const EARLY = new Date('2026-01-01T00:00:00Z');

test('all slots on a free working day', () => {
  const r = availableSlots({ schedule, date: MONDAY, appointments: [], now: EARLY });
  assert.deepEqual(r, { slots: ['09:00', '09:30', '10:00', '10:30'], reason: null });
});

test('incomplete schedule -> no_schedule', () => {
  for (const s of [{}, { ...schedule, startTime: '' }, { ...schedule, slotMinutes: 0 }, { ...schedule, workingDays: [] },
    { ...schedule, startTime: '12:00', endTime: '11:00' }]) {
    assert.equal(availableSlots({ schedule: s, date: MONDAY, appointments: [], now: EARLY }).reason, 'no_schedule');
  }
});

test('non-working day', () => {
  assert.deepEqual(availableSlots({ schedule, date: TUESDAY, appointments: [], now: EARLY }), { slots: [], reason: 'not_working_day' });
});

test('upcoming appointments take their slot; other statuses release it', () => {
  const appts = [
    { date: MONDAY, time: '9:00 AM', status: 'upcoming' },
    { date: MONDAY, time: '9:30 AM', status: 'cancelled' },
    { date: MONDAY, time: '10:00 AM', status: 'completed' },
    { date: MONDAY, time: '10:30 AM', status: 'missed' },
    { date: TUESDAY, time: '10:30 AM', status: 'upcoming' },
  ];
  assert.deepEqual(availableSlots({ schedule, date: MONDAY, appointments: appts, now: EARLY }).slots, ['09:30', '10:00', '10:30']);
});

test('an off-grid appointment blocks every slot it overlaps', () => {
  const r = availableSlots({ schedule, date: MONDAY, appointments: [{ date: MONDAY, time: '9:45 AM', status: 'upcoming' }], now: EARLY });
  assert.deepEqual(r.slots, ['09:00', '10:30']);
});

test('fully booked', () => {
  const appts = ['9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM'].map((time) => ({ date: MONDAY, time, status: 'upcoming' }));
  assert.deepEqual(availableSlots({ schedule, date: MONDAY, appointments: appts, now: EARLY }), { slots: [], reason: 'fully_booked' });
});

test('patient windows: overlap and no overlap', () => {
  const windows = [{ date: MONDAY, from: '09:30', to: '10:30' }, { date: '2030-01-09', from: '09:00', to: '09:30' }];
  assert.deepEqual(availableSlots({ schedule, date: MONDAY, appointments: [], windows, now: EARLY }).slots, ['09:30', '10:00']);
  const late = [{ date: MONDAY, from: '14:00', to: '15:00' }];
  assert.deepEqual(availableSlots({ schedule, date: MONDAY, appointments: [], windows: late, now: EARLY }), { slots: [], reason: 'no_overlap' });
  const otherDay = [{ date: '2030-01-09', from: '09:00', to: '11:00' }];
  assert.equal(availableSlots({ schedule, date: MONDAY, appointments: [], windows: otherDay, now: EARLY }).reason, 'no_overlap');
});

test('past times are excluded (Manila clock)', () => {
  // 2030-01-07 09:45 in Manila = 01:45 UTC.
  const now = new Date('2030-01-07T01:45:00Z');
  assert.deepEqual(availableSlots({ schedule, date: MONDAY, appointments: [], now }).slots, ['10:00', '10:30']);
  assert.equal(availableSlots({ schedule, date: MONDAY, appointments: [], now: new Date('2030-01-08T00:00:00Z') }).reason, 'fully_booked');
});

test('helpers', () => {
  assert.equal(weekdayOf(MONDAY), 1);
  assert.equal(timeToMinutes('12:00 AM'), 0);
  assert.equal(timeToMinutes('12:30 PM'), 750);
  assert.equal(timeToMinutes('09:15'), 555);
  assert.equal(timeToMinutes('nonsense'), null);
  assert.equal(hhmmTo12h('13:05'), '1:05 PM');
  assert.equal(slotLockId('doc1', MONDAY, '09:30'), 'doc1_2030-01-07_09-30');
  assert.deepEqual(clinicNow(new Date('2030-01-06T16:30:00Z')), { date: '2030-01-07', minutes: 30 });
});
