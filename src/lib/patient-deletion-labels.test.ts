// Run: node --import tsx --test src/lib/patient-deletion-labels.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COLLECTION_LABELS, STATUS_LABELS, STEP_LABELS, collectionLabel } from './patient-deletion-labels';

const source = readFileSync(new URL('./patient-deletion.ts', import.meta.url), 'utf8');

test('clinic readings have a label in the deletion preview', () => {
  assert.equal(collectionLabel('clinicReadings'), 'Clinic health readings');
  assert.equal(COLLECTION_LABELS.clinicReadings, 'Clinic health readings');
  for (const name of ['appointments', 'snapshots', 'healthLogs', 'clinicalNotes', 'stays']) assert.notEqual(collectionLabel(name), name);
  assert.equal(collectionLabel('somethingNew'), 'somethingNew'); // unknown names still show
});

test('the deletion steps: every step has a label, in the order they run', () => {
  // Steps run through run(); the closing audit entry is pushed after them.
  const order = [...source.matchAll(/await run\('([a-z_]+)'/g)].map((m) => m[1]);
  assert.ok(source.includes("step: 'audit_entry', status: 'done'"));
  assert.deepEqual([...order, 'audit_entry'], Object.keys(STEP_LABELS));
  assert.deepEqual(Object.keys(STATUS_LABELS), ['done', 'already_gone', 'skipped', 'failed']);
});

test('the records step deletes the whole user document recursively, so clinicReadings goes too', () => {
  const step = source.slice(source.indexOf("await run('firestore_data'"), source.indexOf("await run('username'"));
  assert.match(step, /adminDb\.recursiveDelete\(userRef\)/);
  // It does not pick subcollections by name, which would miss new ones.
  assert.doesNotMatch(step, /collection\('/);
  // The preview counts every subcollection the same way (listCollections).
  assert.match(source, /userRef\.listCollections\(\)/);
});
