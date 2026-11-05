// Run: node --import tsx --test src/lib/clinic-readings.test.ts
// (run it under TZ=Asia/Manila and TZ=UTC: the answers must not change)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { editedReadingFields, formatBp, newReadingDoc, sortReadings, validateReading, type ReadingValues } from './clinic-readings';

const TODAY = '2026-11-05';
const ok = (body: object) => {
  const r = validateReading({ measuredOn: TODAY, ...body }, TODAY);
  assert.ok(r.ok, JSON.stringify(r));
  return r.value;
};
const errs = (body: unknown) => {
  const r = validateReading(body, TODAY);
  assert.ok(!r.ok, 'expected errors');
  return r.errors;
};

test('weight: 30 to 250 kg, one decimal; two decimals are rejected, not rounded', () => {
  assert.equal(ok({ weightKg: 30 }).weightKg, 30);
  assert.equal(ok({ weightKg: 250 }).weightKg, 250);
  assert.equal(ok({ weightKg: 58.4 }).weightKg, 58.4);
  assert.equal(ok({ weightKg: '61.2' }).weightKg, 61.2);
  assert.ok(errs({ measuredOn: TODAY, weightKg: 29.9 }).weightKg);
  assert.ok(errs({ measuredOn: TODAY, weightKg: 250.1 }).weightKg);
  assert.match(errs({ measuredOn: TODAY, weightKg: 58.45 }).weightKg!, /one decimal/);
  assert.ok(errs({ measuredOn: TODAY, weightKg: -60 }).weightKg);
  assert.ok(errs({ measuredOn: TODAY, weightKg: '60kg' }).weightKg);
  assert.ok(errs({ measuredOn: TODAY, weightKg: Number.NaN }).weightKg);
});

test('blood pressure: whole numbers, systolic 60-260, diastolic 30-160', () => {
  assert.deepEqual([ok({ bpSys: 60, bpDia: 30 }).bpSys, ok({ bpSys: 60, bpDia: 30 }).bpDia], [60, 30]);
  assert.equal(ok({ bpSys: 260, bpDia: 160 }).bpSys, 260);
  assert.ok(errs({ measuredOn: TODAY, bpSys: 59, bpDia: 40 }).bpSys);
  assert.ok(errs({ measuredOn: TODAY, bpSys: 261, bpDia: 80 }).bpSys);
  assert.ok(errs({ measuredOn: TODAY, bpSys: 120, bpDia: 29 }).bpDia);
  assert.ok(errs({ measuredOn: TODAY, bpSys: 200, bpDia: 161 }).bpDia);
  assert.ok(errs({ measuredOn: TODAY, bpSys: 120.5, bpDia: 80 }).bpSys);
});

test('blood pressure needs both values, and systolic above diastolic', () => {
  assert.match(errs({ measuredOn: TODAY, bpSys: 120 }).bpDia!, /diastolic/);
  assert.match(errs({ measuredOn: TODAY, bpDia: 80 }).bpSys!, /systolic/);
  assert.match(errs({ measuredOn: TODAY, bpSys: 80, bpDia: 80 }).bpSys!, /higher/);
  assert.ok(errs({ measuredOn: TODAY, bpSys: 79, bpDia: 80 }).bpSys);
  assert.equal(ok({ bpSys: 81, bpDia: 80 }).bpSys, 81);
  // Weight alone stores no blood pressure; blank strings count as none.
  const w = ok({ weightKg: 60, bpSys: '', bpDia: null });
  assert.deepEqual([w.bpSys, w.bpDia], [null, null]);
});

test('at least one measurement', () => {
  assert.ok(errs({ measuredOn: TODAY }).form);
  assert.ok(errs({ measuredOn: TODAY, weightKg: '', note: 'only a note' }).form);
  // A field error already explains it: no extra form error.
  assert.equal(errs({ measuredOn: TODAY, weightKg: 10 }).form, undefined);
});

test('measuredOn: a real date, today allowed, not in the future', () => {
  assert.equal(ok({ weightKg: 60, measuredOn: TODAY }).measuredOn, TODAY);
  assert.equal(ok({ weightKg: 60, measuredOn: '2020-02-29' }).measuredOn, '2020-02-29');
  assert.match(errs({ weightKg: 60, measuredOn: '2026-11-06' }).measuredOn!, /future/);
  assert.match(errs({ weightKg: 60, measuredOn: '2026-02-30' }).measuredOn!, /real date/);
  assert.match(errs({ weightKg: 60, measuredOn: '2026-1-05' }).measuredOn!, /real date/);
  assert.match(errs({ weightKg: 60 }).measuredOn!, /Choose/);
});

test('note: trimmed, up to 300 characters, text only', () => {
  assert.equal(ok({ weightKg: 60, note: '  after lunch  ' }).note, 'after lunch');
  assert.equal(ok({ weightKg: 60 }).note, '');
  assert.equal(ok({ weightKg: 60, note: 'a'.repeat(300) }).note.length, 300);
  assert.equal(ok({ weightKg: 60, note: ` ${'a'.repeat(300)} ` }).note.length, 300);
  assert.ok(errs({ measuredOn: TODAY, weightKg: 60, note: 'a'.repeat(301) }).note);
  assert.ok(errs({ measuredOn: TODAY, weightKg: 60, note: 42 }).note);
});

test('malformed bodies are refused', () => {
  for (const body of [null, undefined, 'text', 42, [], [{ weightKg: 60 }]]) assert.ok(errs(body).form);
});

test('who entered it comes from the session; a spoofed body is ignored', () => {
  const body = { measuredOn: TODAY, weightKg: 60, enteredByUid: 'someone-else', enteredByName: 'Dr Fake', enteredAt: 1 };
  const r = validateReading(body, TODAY);
  assert.ok(r.ok);
  assert.deepEqual(Object.keys(r.value).sort(), ['bpDia', 'bpSys', 'measuredOn', 'note', 'weightKg']);
  const doc = newReadingDoc(r.value, { uid: 'doc-1', doctorName: 'Dr Real' }, 'NOW');
  assert.equal(doc.enteredByUid, 'doc-1');
  assert.equal(doc.enteredByName, 'Dr Real');
  assert.equal(doc.enteredAt, 'NOW');
  // An edit never touches who entered it or when.
  const edit = editedReadingFields(r.value as ReadingValues, 'LATER');
  assert.deepEqual(Object.keys(edit).sort(), ['bpDia', 'bpSys', 'measuredOn', 'note', 'updatedAt', 'weightKg']);
});

test('list order: newest measuredOn first, same day by entry time', () => {
  const r = sortReadings([
    { id: 'a', measuredOn: '2026-10-01', enteredAt: 5 },
    { id: 'b', measuredOn: '2026-11-01', enteredAt: 1 },
    { id: 'c', measuredOn: '2026-11-01', enteredAt: 9 },
  ]);
  assert.deepEqual(r.map((x) => x.id), ['c', 'b', 'a']);
  assert.equal(formatBp({ bpSys: 120, bpDia: 80 }), '120/80');
  assert.equal(formatBp({ bpSys: null, bpDia: null }), '');
});
