import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getAdminSession } from '@/lib/get-admin-session';
import { logAuditEvent } from '@/lib/audit-log';
import { isNonPatientUid } from '@/lib/patient-deletion';
import { manilaKey } from '@/lib/report-aggregations';
import { dobKey, validateDob } from '@/lib/date-of-birth';

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * Admin only. PUT { dob: "YYYY-MM-DD" | null }: sets (or removes) a
 * patient's date of birth on the existing profile field `dob`. The date
 * must be real, not in the future, and give an age of 10 to 60 today
 * (Philippine date). Written with the Admin SDK, so no rule change. The
 * audit entry says what happened, never the date itself.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const { uid } = await params;
  const body = await req.json().catch(() => null);
  if (!ID_PATTERN.test(uid) || !body || !('dob' in body)) {
    return NextResponse.json({ error: 'Send a date of birth, or null to remove it.' }, { status: 400 });
  }

  let dob: string | null = null;
  if (body.dob !== null) {
    const checked = validateDob(body.dob, manilaKey(new Date()));
    if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
    dob = checked.dob;
  }

  try {
    const ref = adminDb.collection('users').doc(uid);
    const [snap, staff] = await Promise.all([ref.get(), isNonPatientUid(uid)]);
    if (!snap.exists || staff) {
      return NextResponse.json({ error: 'Patient not found.' }, { status: 404 });
    }

    const before = dobKey(snap.get('dob'));
    if (before === dob) return NextResponse.json({ success: true, dob, changed: false });

    await ref.update({ dob: dob ?? '' });

    await logAuditEvent({
      actorUid: session.uid,
      actorEmail: session.email ?? 'unknown',
      actorRole: 'admin',
      action: 'user.dob_update',
      targetType: 'user',
      targetId: uid,
      targetLabel: String(snap.get('fullName') ?? '').trim() || 'Patient',
      // What changed, never the date.
      details: dob === null ? 'Date of birth removed' : before ? 'Date of birth changed' : 'Date of birth added',
    });

    return NextResponse.json({ success: true, dob, changed: true });
  } catch (err: unknown) {
    console.error('Failed to save date of birth:', (err as { code?: unknown })?.code ?? (err as Error)?.message ?? 'unknown');
    return NextResponse.json({ error: 'Could not save the date of birth. Please try again.' }, { status: 500 });
  }
}
