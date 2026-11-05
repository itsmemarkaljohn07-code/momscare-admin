// Run: node --import tsx --test src/lib/clinic-readings.test.ts
// (run it under TZ=Asia/Manila and TZ=UTC: the answers must not change)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { editedReadingFields, formatBp, newReadingDoc, readingFromData, sortReadings, validateReading, type ReadingValues } from './clinic-readings';

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
  assert.deepEqual(Object.keys(r.value).sort(), ['bpDia', 'bpSys', 'fetalHeartRate', 'fundalHeightCm', 'measuredOn', 'note', 'pulse', 'temperatureC', 'weightKg']);
  const doc = newReadingDoc(r.value, { uid: 'doc-1', doctorName: 'Dr Real' }, 'NOW');
  assert.equal(doc.enteredByUid, 'doc-1');
  assert.equal(doc.enteredByName, 'Dr Real');
  assert.equal(doc.enteredAt, 'NOW');
  // An edit never touches who entered it or when.
  const edit = editedReadingFields(r.value as ReadingValues, 'LATER');
  assert.deepEqual(Object.keys(edit).sort(), ['bpDia', 'bpSys', 'fetalHeartRate', 'fundalHeightCm', 'measuredOn', 'note', 'pulse', 'temperatureC', 'updatedAt', 'weightKg']);
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

test('fundal height: 5 to 60 cm, one decimal (typing guard)', () => {
  assert.equal(ok({ fundalHeightCm: 5 }).fundalHeightCm, 5);
  assert.equal(ok({ fundalHeightCm: 60 }).fundalHeightCm, 60);
  assert.equal(ok({ fundalHeightCm: '24.5' }).fundalHeightCm, 24.5);
  assert.equal(errs({ measuredOn: TODAY, fundalHeightCm: 4.9 }).fundalHeightCm, 'Between 5 and 60 cm.');
  assert.ok(errs({ measuredOn: TODAY, fundalHeightCm: 60.1 }).fundalHeightCm);
  assert.match(errs({ measuredOn: TODAY, fundalHeightCm: 24.55 }).fundalHeightCm!, /one decimal/);
});

test('fetal heart rate: whole number 60 to 220', () => {
  assert.equal(ok({ fetalHeartRate: 60 }).fetalHeartRate, 60);
  assert.equal(ok({ fetalHeartRate: '220' }).fetalHeartRate, 220);
  assert.equal(errs({ measuredOn: TODAY, fetalHeartRate: 59 }).fetalHeartRate, 'A whole number from 60 to 220.');
  assert.ok(errs({ measuredOn: TODAY, fetalHeartRate: 221 }).fetalHeartRate);
  assert.ok(errs({ measuredOn: TODAY, fetalHeartRate: 140.5 }).fetalHeartRate);
});

test('pulse: whole number 30 to 220', () => {
  assert.equal(ok({ pulse: 30 }).pulse, 30);
  assert.equal(ok({ pulse: 220 }).pulse, 220);
  assert.equal(errs({ measuredOn: TODAY, pulse: 29 }).pulse, 'A whole number from 30 to 220.');
  assert.ok(errs({ measuredOn: TODAY, pulse: 221 }).pulse);
  assert.ok(errs({ measuredOn: TODAY, pulse: 140.5 }).pulse);
});

test('temperature: 33.0 to 43.0 °C, one decimal', () => {
  assert.equal(ok({ temperatureC: 33 }).temperatureC, 33);
  assert.equal(ok({ temperatureC: 43 }).temperatureC, 43);
  assert.equal(ok({ temperatureC: '36.8' }).temperatureC, 36.8);
  assert.equal(errs({ measuredOn: TODAY, temperatureC: 32.9 }).temperatureC, 'Between 33.0 and 43.0 °C.');
  assert.ok(errs({ measuredOn: TODAY, temperatureC: 43.1 }).temperatureC);
  assert.match(errs({ measuredOn: TODAY, temperatureC: 36.85 }).temperatureC!, /one decimal/);
});

test('blank strings are not taken; one new field alone is a reading; all six together', () => {
  const blankAll = { weightKg: '', bpSys: ' ', bpDia: '', fundalHeightCm: '', fetalHeartRate: '', pulse: '', temperatureC: '' };
  assert.equal(errs({ measuredOn: TODAY, ...blankAll }).form, 'Enter at least one measurement.');
  const onlyPulse = ok({ ...blankAll, pulse: '84' });
  assert.deepEqual(onlyPulse, { weightKg: null, bpSys: null, bpDia: null, fundalHeightCm: null, fetalHeartRate: null, pulse: 84, temperatureC: null, note: '', measuredOn: TODAY });
  for (const field of ['fundalHeightCm', 'fetalHeartRate', 'temperatureC'] as const) {
    const v = ok({ [field]: field === 'temperatureC' ? 36.5 : field === 'fundalHeightCm' ? 30 : 140 });
    assert.notEqual(v[field], null);
  }
  const all = ok({ weightKg: 62.4, bpSys: 120, bpDia: 80, fundalHeightCm: 28.5, fetalHeartRate: 142, pulse: 84, temperatureC: 36.8, note: 'all six' });
  assert.deepEqual(all, { weightKg: 62.4, bpSys: 120, bpDia: 80, fundalHeightCm: 28.5, fetalHeartRate: 142, pulse: 84, temperatureC: 36.8, note: 'all six', measuredOn: TODAY });
});

test('blood pressure pair rules are unchanged with the new fields', () => {
  assert.ok(errs({ measuredOn: TODAY, pulse: 80, bpSys: 120 }).bpDia);
  assert.ok(errs({ measuredOn: TODAY, pulse: 80, bpDia: 80 }).bpSys);
  assert.match(errs({ measuredOn: TODAY, pulse: 80, bpSys: 80, bpDia: 80 }).bpSys!, /higher/);
});

test('an edit stores every value, so a blank field clears it', () => {
  const v = ok({ weightKg: 60, pulse: '' });
  const edit = editedReadingFields(v, 'NOW');
  assert.equal(edit.pulse, null);
  assert.ok('pulse' in edit && 'temperatureC' in edit && 'fundalHeightCm' in edit && 'fetalHeartRate' in edit);
});

test('old documents without the new fields still load; bad values read as null', () => {
  const ts = (ms: number) => ({ toMillis: () => ms });
  const old = readingFromData('r1', { weightKg: 61, bpSys: 118, bpDia: 76, note: '', measuredOn: '2026-11-01', enteredByUid: 'd', enteredByName: 'Dr', enteredAt: ts(5), updatedAt: ts(6) });
  assert.deepEqual([old.fundalHeightCm, old.fetalHeartRate, old.pulse, old.temperatureC], [null, null, null, null]);
  assert.deepEqual([old.weightKg, old.bpSys, old.bpDia, old.enteredAt, old.updatedAt], [61, 118, 76, 5, 6]);
  const odd = readingFromData('r2', { pulse: '84', temperatureC: Number.NaN, fundalHeightCm: Infinity, fetalHeartRate: null });
  assert.deepEqual([odd.pulse, odd.temperatureC, odd.fundalHeightCm, odd.fetalHeartRate, odd.measuredOn, odd.enteredAt], [null, null, null, null, '', 0]);
});

test('a spoofed enteredBy is ignored with the new fields too', () => {
  const r = validateReading({ measuredOn: TODAY, pulse: 80, enteredByUid: 'x', enteredByName: 'Dr Fake', fundal: 3 }, TODAY);
  assert.ok(r.ok);
  const doc = newReadingDoc(r.value, { uid: 'doc-1', doctorName: 'Dr Real' }, 'NOW');
  assert.deepEqual([doc.enteredByUid, doc.enteredByName, doc.pulse], ['doc-1', 'Dr Real', 80]);
  assert.ok(!('fundal' in doc));
});
