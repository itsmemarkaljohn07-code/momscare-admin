// Run: node --import tsx --test src/lib/stays.test.ts
// (run it under TZ=Asia/Manila and TZ=UTC: the answers must not change)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { manilaDay, parseManila, staysOverlap, toManilaInput, validateStay, type Stay } from './stays';

const NOW = parseManila('2026-10-24T12:00')!;
const stay = (over: Partial<Stay> = {}): Stay => ({
  admittedAt: parseManila('2026-10-10T08:00')!, deliveredAt: null, outcome: null, babySex: null,
  birthWeightG: null, birthLengthCm: null, dischargedAt: null, transferredAt: null, ...over,
});

test('Manila date and time parse and print back, day boundaries', () => {
  assert.equal(parseManila('2026-10-01T00:01'), Date.UTC(2026, 8, 30, 16, 1));
  assert.equal(manilaDay(parseManila('2026-09-30T23:59')!), '2026-09-30');
  assert.equal(manilaDay(parseManila('2026-10-01T00:01')!), '2026-10-01');
  assert.equal(toManilaInput(parseManila('2026-10-01T00:01')), '2026-10-01T00:01');
  assert.equal(parseManila('2026-02-30T10:00'), null);
  assert.equal(parseManila('2026-10-01T24:00'), null);
  assert.equal(parseManila('2026-10-01 10:00'), null);
});

test('a full live birth is accepted', () => {
  const r = validateStay({
    admittedAt: '2026-10-10T08:00', deliveredAt: '2026-10-10T14:30', outcome: 'live', babySex: 'female',
    birthWeightG: '3100', birthLengthCm: '49.5', dischargedAt: '2026-10-11T10:00',
  }, [], NOW);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.stay.birthWeightG, 3100);
});

test('date order and future checks', () => {
  const bad = (input: object) => { const r = validateStay(input, [], NOW); return r.ok ? {} : r.errors; };
  assert.ok(bad({ admittedAt: '2026-10-25T08:00' }).admittedAt);
  assert.ok(bad({}).admittedAt);
  assert.ok(bad({ admittedAt: '2026-10-10T08:00', deliveredAt: '2026-10-10T07:59', outcome: 'live', babySex: 'male' }).deliveredAt);
  assert.ok(bad({ admittedAt: '2026-10-10T08:00', deliveredAt: '2026-10-10T14:00', outcome: 'live', babySex: 'male', dischargedAt: '2026-10-10T13:00' }).dischargedAt);
  assert.ok(bad({ admittedAt: '2026-10-10T08:00', dischargedAt: '2026-10-10T07:00' }).dischargedAt);
  assert.ok(bad({ admittedAt: '2026-10-10T08:00', transferredAt: '2026-10-10T07:00' }).transferredAt);
  // Transfer at the admission minute is allowed, without a delivery.
  assert.equal(validateStay({ admittedAt: '2026-10-10T08:00', transferredAt: '2026-10-10T08:00' }, [], NOW).ok, true);
});

test('outcome and baby sex rules; ranges', () => {
  const bad = (input: object) => { const r = validateStay(input, [], NOW); return r.ok ? {} : r.errors; };
  const base = { admittedAt: '2026-10-10T08:00', deliveredAt: '2026-10-10T14:00' };
  assert.ok(bad(base).outcome);
  assert.ok(bad({ ...base, outcome: 'live' }).babySex);
  assert.equal(validateStay({ ...base, outcome: 'stillbirth' }, [], NOW).ok, true);
  assert.ok(bad({ ...base, outcome: 'stillbirth', babySex: 'male' }).babySex);
  assert.ok(bad({ admittedAt: '2026-10-10T08:00', outcome: 'live' }).outcome);
  assert.ok(bad({ ...base, outcome: 'live', babySex: 'male', birthWeightG: '250' }).birthWeightG);
  assert.ok(bad({ ...base, outcome: 'live', babySex: 'male', birthLengthCm: '71' }).birthLengthCm);
  assert.ok(bad({ ...base, outcome: 'stillbirth', birthWeightG: '2000' }).birthWeightG);
});

test('overlap: no two stays of one patient overlap; twins share one stay window', () => {
  const closed = stay({ dischargedAt: parseManila('2026-10-12T08:00')! });
  assert.ok(staysOverlap(stay({ admittedAt: parseManila('2026-10-11T08:00')! }), closed));
  assert.ok(!staysOverlap(stay({ admittedAt: parseManila('2026-10-12T08:00')! }), closed));
  const r = validateStay({ admittedAt: '2026-10-11T09:00' }, [closed], NOW);
  assert.equal(r.ok, false);
  assert.equal(validateStay({ admittedAt: '2026-10-12T09:00' }, [closed], NOW).ok, true);
  // An open stay (no discharge, no transfer) blocks any later one.
  assert.equal(validateStay({ admittedAt: '2026-10-20T09:00' }, [stay()], NOW).ok, false);
  // Twins: same admission and delivery minute.
  const twin = stay({ deliveredAt: parseManila('2026-10-10T14:00')!, outcome: 'live', babySex: 'male' });
  assert.equal(validateStay({ admittedAt: '2026-10-10T08:00', deliveredAt: '2026-10-10T14:00', outcome: 'live', babySex: 'female' }, [twin], NOW).ok, true);
  assert.equal(validateStay({ admittedAt: '2026-10-10T08:00', deliveredAt: '2026-10-10T14:05', outcome: 'live', babySex: 'female' }, [twin], NOW).ok, false);
});
