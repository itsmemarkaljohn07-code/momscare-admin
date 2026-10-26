import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { getAdminSession } from '@/lib/get-admin-session';
import { withRetry } from '@/lib/with-retry';
import { logAuditEvent } from '@/lib/audit-log';
import { reportActor } from '@/lib/report-actor';
import { validRange } from '@/lib/report-aggregations';
import { MAX_ACTIVITY_ENTRIES, buildActivityReport, type ActivityEntry } from '@/lib/activity-report';
import { NAME_FIELDS, patientName } from '@/lib/patient-name';

const BATCH = 500;

/** Start of a Manila (UTC+8, no DST) calendar day. */
const manilaDayStart = (day: string) => new Date(`${day}T00:00:00+08:00`);

/** uid -> readable name for admins, doctor logins and patients. */
async function actorNames(): Promise<Map<string, string>> {
  const [admins, doctors, users] = await Promise.all([
    withRetry(() => adminDb.collection('admins').get()),
    withRetry(() => adminDb.collection('doctorAccounts').select('authUid', 'name').get()),
    withRetry(() => adminDb.collection('users').select(...NAME_FIELDS).get()),
  ]);
  const names = new Map<string, string>();
  for (const d of users.docs) names.set(d.id, patientName(d.data()));
  for (const d of doctors.docs) if (d.get('authUid')) names.set(String(d.get('authUid')), String(d.get('name') ?? '').trim());
  for (const d of admins.docs) names.set(d.id, String(d.get('name') ?? d.get('displayName') ?? '').trim());
  return names;
}

/**
 * Admin only. GET ?from&to (Manila dates, YYYY-MM-DD, both optional): the
 * activity summary's numbers from auditLogs, newest first by createdAt, in
 * cursor batches of 500 on the single-field index, at most 5000 entries
 * (the report says when it stopped there). Free-text details are not read.
 * Each export is itself recorded (report.activity_export).
 */
export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const p = req.nextUrl.searchParams;
  const range = { from: p.get('from') || null, to: p.get('to') || null };
  if (!validRange(range)) {
    return NextResponse.json({ error: 'Choose a valid period (from must be on or before to).' }, { status: 400 });
  }

  try {
    let base = adminDb
      .collection('auditLogs')
      .orderBy('createdAt', 'desc')
      .select('actorUid', 'actorEmail', 'actorRole', 'action', 'targetLabel', 'createdAt');
    if (range.from) base = base.where('createdAt', '>=', Timestamp.fromDate(manilaDayStart(range.from)));
    if (range.to) {
      const next = manilaDayStart(range.to);
      next.setUTCDate(next.getUTCDate() + 1);
      base = base.where('createdAt', '<', Timestamp.fromDate(next));
    }

    const docs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
    let after: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    // One past the cap tells us whether there was more.
    while (docs.length <= MAX_ACTIVITY_ENTRIES) {
      const q: FirebaseFirestore.Query = after ? base.startAfter(after).limit(BATCH) : base.limit(BATCH);
      const snap = await withRetry(() => q.get());
      docs.push(...snap.docs);
      if (snap.size < BATCH) break;
      after = snap.docs[snap.size - 1];
    }
    const capped = docs.length > MAX_ACTIVITY_ENTRIES;

    const [names, generatedBy] = await Promise.all([actorNames(), reportActor(session)]);
    const entries: ActivityEntry[] = docs.slice(0, MAX_ACTIVITY_ENTRIES).map((d) => {
      const uid = String(d.get('actorUid') ?? '');
      const role = String(d.get('actorRole') ?? '');
      const email = typeof d.get('actorEmail') === 'string' ? d.get('actorEmail') : '';
      // Patient entries carry only the uid: never print it.
      const fallback = role === 'patient' ? 'Deleted patient' : email && email.toLowerCase() !== 'unknown' ? email : 'Unknown';
      return {
        createdAt: d.get('createdAt')?.toDate?.().toISOString() ?? null,
        actorRole: role,
        actorName: names.get(uid) || fallback,
        action: String(d.get('action') ?? ''),
        targetLabel: String(d.get('targetLabel') ?? '-'),
      };
    });

    const report = buildActivityReport(entries, range, new Date(), capped);

    await logAuditEvent({
      actorUid: session.uid,
      actorEmail: session.email ?? 'unknown',
      actorRole: 'admin',
      action: 'report.activity_export',
      targetType: 'report',
      targetId: 'activity',
      targetLabel: 'Activity summary',
      details: null,
    });

    return NextResponse.json({ generatedBy, maxEntries: MAX_ACTIVITY_ENTRIES, report });
  } catch (err: unknown) {
    console.error('Failed to build activity report:', (err as { code?: unknown })?.code ?? (err as Error)?.message ?? 'unknown');
    return NextResponse.json({ error: 'Could not build the report. Please try again.' }, { status: 500 });
  }
}
