// Run: node --import tsx --test src/lib/activity-report.test.ts
// (run it under TZ=Asia/Manila and TZ=UTC: the answers must not change)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LATEST_ENTRIES, activityTimeline, buildActivityReport, type ActivityEntry } from './activity-report';

const NOW = new Date('2026-10-19T02:00:00Z');
const e = (createdAt: string, actorRole: string, actorName: string, action: string, targetLabel = 'Ana'): ActivityEntry =>
  ({ createdAt, actorRole, actorName, action, targetLabel });

test('totals by role, actions by readable label, actors by count', () => {
  const r = buildActivityReport(
    [
      e('2026-10-02T01:00:00Z', 'admin', 'Admin One', 'appointment.approve'),
      e('2026-10-02T02:00:00Z', 'admin', 'Admin One', 'appointment.approve'),
      e('2026-10-03T02:00:00Z', 'doctor', 'Dr. B', 'clinical_note.create'),
      e('2026-10-04T02:00:00Z', 'patient', 'Ana', 'appointment_request.create'),
      e('2026-10-04T03:00:00Z', 'admin', 'Admin One', 'some.unknown_action'),
    ],
    { from: '2026-10-01', to: '2026-10-05' },
    NOW,
    false
  );
  assert.deepEqual(r.totals, { all: 5, admin: 3, doctor: 1, patient: 1 });
  assert.deepEqual(r.byAction[0], { label: 'Approved appointment', count: 2 });
  assert.ok(r.byAction.some((a) => a.label === 'some.unknown_action'));
  assert.deepEqual(r.byActor[0], { name: 'Admin One', role: 'Admin', count: 3 });
  assert.deepEqual(r.byActor.map((a) => a.role).sort(), ['Admin', 'Doctor', 'Patient']);
});

test('per-day buckets cover the whole period in Manila days, zeros included', () => {
  // Oct 1 17:00 UTC is Oct 2 01:00 in Manila.
  const r = buildActivityReport(
    [e('2026-10-01T17:00:00Z', 'admin', 'A', 'doctor.update'), e('2026-10-03T01:00:00Z', 'admin', 'A', 'doctor.update')],
    { from: '2026-10-01', to: '2026-10-04' },
    NOW,
    false
  );
  assert.equal(r.timeline.unit, 'day');
  assert.deepEqual(r.timeline.buckets, [
    { key: '2026-10-01', count: 0 }, { key: '2026-10-02', count: 1 }, { key: '2026-10-03', count: 1 }, { key: '2026-10-04', count: 0 },
  ]);
});

test('a long period is charted per month; all time spans first to last entry', () => {
  const t = activityTimeline(['2026-01-15', '2026-04-02', '2026-04-09'], { from: null, to: null });
  assert.equal(t.unit, 'month');
  assert.deepEqual(t.buckets, [{ key: '2026-01', count: 1 }, { key: '2026-02', count: 0 }, { key: '2026-03', count: 0 }, { key: '2026-04', count: 2 }]);
  assert.deepEqual(activityTimeline([], { from: null, to: null }).buckets, []);
});

test('latest entries: newest first, capped, no details, dash for a missing target', () => {
  const many = Array.from({ length: 50 }, (_, i) =>
    e(new Date(Date.UTC(2026, 9, 1, i)).toISOString(), 'admin', 'A', 'user.suspend', i === 49 ? '—' : `P${i}`));
  const r = buildActivityReport(many, { from: null, to: null }, NOW, true);
  assert.equal(r.latest.length, LATEST_ENTRIES);
  assert.equal(r.latest[0].target, '-');
  assert.equal(r.latest[1].target, 'P48');
  assert.equal(r.latest[0].action, 'Suspended patient account');
  assert.equal(r.capped, true);
  assert.ok(!('details' in r.latest[0]));
});
