// Run: node --import tsx --test src/lib/audit-labels.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ACTION_LABELS, actionLabel } from './audit-labels';
import { buildActivityReport } from './activity-report';

test('clinic reading actions have friendly names', () => {
  assert.equal(actionLabel('clinic_reading.create'), 'Health reading added');
  assert.equal(actionLabel('clinic_reading.update'), 'Health reading changed');
  assert.equal(actionLabel('clinic_reading.delete'), 'Health reading deleted');
  assert.equal(actionLabel('something.unknown'), 'something.unknown');
});

test('the audit log action filter has a group for clinic readings', () => {
  // The filter lists ACTION_LABELS keys under each GROUPS key (the part before the dot).
  const table = readFileSync(new URL('../components/audit-log-table.tsx', import.meta.url), 'utf8');
  const groups = [...table.slice(table.indexOf('const GROUPS'), table.indexOf('};', table.indexOf('const GROUPS'))).matchAll(/^\s+([a-z_]+): \{ label/gm)].map((m) => m[1]);
  assert.ok(groups.includes('clinic_reading'));
  const inFilter = Object.keys(ACTION_LABELS).filter((a) => groups.includes(a.split('.')[0]));
  for (const a of ['clinic_reading.create', 'clinic_reading.update', 'clinic_reading.delete']) assert.ok(inFilter.includes(a), a);
});

test('the activity report counts clinic reading actions by their names', () => {
  const entry = (action: string) => ({ createdAt: '2026-11-03T01:00:00.000Z', actorName: 'Dr', actorRole: 'doctor', action, targetLabel: 'P' });
  const r = buildActivityReport([entry('clinic_reading.create'), entry('clinic_reading.create'), entry('clinic_reading.delete')], { from: null, to: null }, new Date('2026-11-07T00:00:00Z'), true);
  assert.deepEqual(r.byAction, [{ label: 'Health reading added', count: 2 }, { label: 'Health reading deleted', count: 1 }]);
});
