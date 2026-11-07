// Run: node --import tsx --test src/lib/patient-reported.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { latestPatientReported } from './patient-reported';

const photo = (createdAt: string, healthSnapshot: object | null) => ({ createdAt, healthSnapshot });

test('the newest Snapshot with a weight or a full blood pressure', () => {
  assert.deepEqual(latestPatientReported([photo('2026-11-04T02:00:00Z', { weight: 59.4, bpSys: 118, bpDia: 76 }), photo('2026-10-05T02:00:00Z', { weight: 57.2 })]), {
    weightKg: 59.4, bpSys: 118, bpDia: 76, at: '2026-11-04T02:00:00Z',
  });
  // A photo without health values, or with zeros, is skipped.
  assert.equal(latestPatientReported([photo('2026-11-05T02:00:00Z', null), photo('2026-11-04T02:00:00Z', { weight: 0, bpSys: 0, bpDia: 0 })]), null);
  // Half a blood pressure is no blood pressure.
  assert.deepEqual(latestPatientReported([photo('2026-11-04T02:00:00Z', { weight: 60, bpSys: 118 })]), { weightKg: 60, bpSys: null, bpDia: null, at: '2026-11-04T02:00:00Z' });
  assert.equal(latestPatientReported([]), null);
});
