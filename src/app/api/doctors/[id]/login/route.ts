import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { getAdminSession } from '@/lib/get-admin-session';
import { logAuditEvent } from '@/lib/audit-log';

const SYNTHETIC_EMAIL_DOMAIN = 'doctors.momscare.internal';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const { id } = await params;
  const { username, password } = await req.json();

  if (!username || username.trim().length < 3) {
    return NextResponse.json({ error: 'Username must be at least 3 characters.' }, { status: 400 });
  }
  if (!password || password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
  }

  const normalizedUsername = username.trim().toLowerCase();

  try {
    const doctorDoc = await adminDb.collection('doctors').doc(id).get();
    if (!doctorDoc.exists) {
      return NextResponse.json({ error: 'Doctor not found.' }, { status: 404 });
    }
    const doctorData = doctorDoc.data()!;

    // Uniqueness check — excludes this doctor's own current record, so
    // re-saving the same username during a reset doesn't false-flag.
    const existing = await adminDb
      .collection('doctors')
      .where('username', '==', normalizedUsername)
      .get();
    if (existing.docs.some((d) => d.id !== id)) {
      return NextResponse.json({ error: 'This username is already taken.' }, { status: 400 });
    }

    // If this doctor already has a login account (old email-based, or
    // a previous username-based one), remove ONLY that authentication
    // credential. Deleting a Firebase Auth user also immediately
    // invalidates any of their existing sessions — the doctor's
    // profile document, patients, and appointments are never touched.
    const oldAuthUid: string | undefined = doctorData.authUid;
    const isReset = !!oldAuthUid;
    if (oldAuthUid) {
      try {
        await adminAuth.deleteUser(oldAuthUid);
      } catch (err) {
        console.warn('Old doctor auth account was already missing or failed to delete:', err);
      }
      try {
        await adminDb.collection('doctorAccounts').doc(oldAuthUid).delete();
      } catch { /* best-effort cleanup */ }
    }

    const syntheticEmail = `${normalizedUsername}@${SYNTHETIC_EMAIL_DOMAIN}`;
    const authUser = await adminAuth.createUser({ email: syntheticEmail, password });

    await adminAuth.setCustomUserClaims(authUser.uid, {
      doctorId: id,
      doctorName: doctorData.name,
    });

    await adminDb.collection('doctorAccounts').doc(authUser.uid).set({
      doctorId: id,
      username: normalizedUsername,
    });

    await adminDb.collection('doctors').doc(id).update({
      authUid: authUser.uid,
      username: normalizedUsername,
      loginEmail: syntheticEmail,
    });

    await logAuditEvent({
      actorUid: session.uid,
      actorEmail: session.email ?? 'unknown',
      actorRole: 'admin',
      action: isReset ? 'doctor.reset_login' : 'doctor.setup_login',
      targetType: 'doctor',
      targetId: id,
      targetLabel: doctorData.name,
      details: `Username: ${normalizedUsername}`,
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Failed to set up doctor login:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}