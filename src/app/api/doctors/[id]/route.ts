import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { getAdminSession } from '@/lib/get-admin-session';
import { logAuditEvent } from '@/lib/audit-log';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const { id } = await params;
  const { name, specialty, workingDays, startTime, endTime, slotMinutes, username  } = await req.json();

  if (!name || !specialty || !Array.isArray(workingDays) || workingDays.length === 0 || !startTime || !endTime || !slotMinutes) {
    return NextResponse.json({ error: 'Please complete all required fields.' }, { status: 400 });
  }

  try {
    const doctorRef = adminDb.collection('doctors').doc(id);
    const existing = await doctorRef.get();
    if (!existing.exists) {
      return NextResponse.json({ error: 'Doctor not found.' }, { status: 404 });
    }
    const storedName: string = existing.data()?.name ?? '';

    // A doctor's name is what appointments, patient assignments and
    // the doctor's own login are linked by — changing it here would
    // update only this record and silently detach all of those.
    // Enforced on the server (not just by disabling the form field),
    // so a direct API call can't bypass it either.
    if (String(name).trim() !== storedName.trim()) {
      return NextResponse.json(
        {
          error:
            "A doctor's name can't be changed — their appointments, patients and login are linked to it. To correct a name, remove the doctor and add them again.",
        },
        { status: 400 }
      );
    }

    // Deliberately not writing `name`: the stored value is kept as-is.
    await doctorRef.update({
      specialty, workingDays, startTime, endTime, slotMinutes: Number(slotMinutes),
      ...(username ? { username: username.toLowerCase() } : {}),
    });

    await logAuditEvent({
      actorUid: session.uid,
      actorEmail: session.email ?? 'unknown',
      actorRole: 'admin',
      action: 'doctor.update',
      targetType: 'doctor',
      targetId: id,
      targetLabel: storedName,
      details: null,
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Failed to update doctor:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Fetched before deletion — there's nothing left to read from
    // afterward, and a log entry that just says "doctor <id>" is far
    // less useful than one with their actual name.
    const doctorRef = adminDb.collection('doctors').doc(id);
    const doctorSnap = await doctorRef.get();
    if (!doctorSnap.exists) {
      return NextResponse.json({ error: 'Doctor not found.' }, { status: 404 });
    }
    const doctorData = doctorSnap.data()!;
    const doctorName: string = doctorData.name ?? id;
    const authUid: string | undefined = doctorData.authUid;

    let auditDetails = 'No login account was on file';

    if (authUid) {
      // The login account goes FIRST. If this fails for a real reason
      // we stop here and leave the doctor record untouched, rather
      // than deleting the doctor and leaving behind a login that
      // still works — the exact half-finished state this prevents.
      try {
        await adminAuth.deleteUser(authUid);
        auditDetails = 'Login account also deleted';
      } catch (authErr: unknown) {
        const code =
          authErr && typeof authErr === 'object' && 'code' in authErr
            ? (authErr as { code?: string }).code
            : undefined;
        if (code === 'auth/user-not-found') {
          // Already gone — nothing to remove, carry on.
          auditDetails = 'Login account was already missing';
        } else {
          console.error('Failed to delete doctor login account:', authErr);
          return NextResponse.json(
            { error: 'The doctor was not removed because their login account could not be deleted. Please try again.' },
            { status: 500 }
          );
        }
      }

      try {
        await adminDb.collection('doctorAccounts').doc(authUid).delete();
      } catch {
        /* best-effort cleanup — the login itself is already gone */
      }
    }

    await doctorRef.delete();

    await logAuditEvent({
      actorUid: session.uid,
      actorEmail: session.email ?? 'unknown',
      actorRole: 'admin',
      action: 'doctor.delete',
      targetType: 'doctor',
      targetId: id,
      targetLabel: doctorName,
      details: auditDetails,
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Failed to delete doctor:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}