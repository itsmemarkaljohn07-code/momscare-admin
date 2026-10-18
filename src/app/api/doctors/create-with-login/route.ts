import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { getAdminSession } from '@/lib/get-admin-session';
import { Timestamp } from 'firebase-admin/firestore';
import { logAuditEvent } from '@/lib/audit-log';
import { cleanSpecialty, SPECIALTY_ERROR } from '@/lib/doctor-specialty';

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const { name, specialty, workingDays, startTime, endTime, slotMinutes, email, password, username } =
    await req.json();

  if (
    !name || !specialty || !Array.isArray(workingDays) || workingDays.length === 0 ||
    !startTime || !endTime || !slotMinutes
  ) {
    return NextResponse.json({ error: 'Please complete all doctor details.' }, { status: 400 });
  }
  if (!email || !password || password.length < 6) {
    return NextResponse.json(
      { error: 'A valid email and a password of at least 6 characters are required.' },
      { status: 400 }
    );
  }
  if (!username || username.trim().length < 3) {
    return NextResponse.json(
      { error: 'A username of at least 3 characters is required.' },
      { status: 400 }
    );
  }

  const cleanedSpecialty = cleanSpecialty(specialty);
  if (!cleanedSpecialty) {
    return NextResponse.json({ error: SPECIALTY_ERROR }, { status: 400 });
  }

  const normalizedUsername = username.trim().toLowerCase();
  const normalizedEmail = email.trim().toLowerCase();

  const existingUsername = await adminDb
    .collection('doctors')
    .where('username', '==', normalizedUsername)
    .limit(1)
    .get();
  if (!existingUsername.empty) {
    return NextResponse.json({ error: 'Username is already taken.' }, { status: 400 });
  }

  // Re-check email server-side too — the client's live check is a UX
  // nicety, not the source of truth. Without this, createUser() would
  // still catch a collision, but surface Firebase's raw error message
  // instead of a friendly one.
  try {
    await adminAuth.getUserByEmail(normalizedEmail);
    return NextResponse.json({ error: 'Email is already registered.' }, { status: 400 });
  } catch (err: unknown) {
    const code = err && typeof err === 'object' && 'code' in err ? (err as { code?: string }).code : undefined;
    if (code !== 'auth/user-not-found') {
      console.error('Email availability check failed:', err);
      return NextResponse.json({ error: 'Could not verify email availability. Please try again.' }, { status: 500 });
    }
    // user-not-found is the expected/good case — email is free, fall through.
  }

  // Create the Auth account FIRST — if anything after this fails, we
  // delete it again, so a retry never collides on "email already in
  // use" from a half-finished attempt.
  let authUid: string | null = null;

  try {
    const authUser = await adminAuth.createUser({ email: normalizedEmail, password });
    authUid = authUser.uid;

    const docRef = await adminDb.collection('doctors').add({
      name,
      specialty: cleanedSpecialty,
      workingDays,
      startTime,
      endTime,
      slotMinutes: Number(slotMinutes),
      authUid,
      loginEmail: normalizedEmail,
      username: normalizedUsername,
      createdAt: Timestamp.now(),
    });

    await adminAuth.setCustomUserClaims(authUid, {
      doctorId: docRef.id,
      doctorName: name,
    });

    await adminDb.collection('doctorAccounts').doc(authUid).set({
      doctorId: docRef.id,
      email: normalizedEmail,
    });

    await logAuditEvent({
      actorUid: session.uid,
      actorEmail: session.email ?? 'unknown',
      actorRole: 'admin',
      action: 'doctor.create_account',
      targetType: 'doctor',
      targetId: docRef.id,
      targetLabel: name,
      details: `Created login for ${normalizedEmail} (username: ${normalizedUsername})`,
    });

    return NextResponse.json({ success: true, id: docRef.id });
  } catch (err: unknown) {
    if (authUid) {
      try {
        await adminAuth.deleteUser(authUid);
      } catch {
        // best-effort cleanup
      }
    }
    console.error('Failed to create doctor account:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
