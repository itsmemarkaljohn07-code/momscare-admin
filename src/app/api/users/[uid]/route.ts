import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { getAdminSession } from '@/lib/get-admin-session';
import { logAuditEvent } from '@/lib/audit-log';
import {
  confirmationMatches,
  deletePatient,
  getDeletionPreview,
  getPatientIdentity,
  isNonPatientUid,
} from '@/lib/patient-deletion';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
){
  
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const { uid } = await params;
  const { disabled } = await req.json();

  if (typeof disabled !== 'boolean') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  try {
    const userDoc = await adminDb.collection('users').doc(uid).get();
    const fullName: string = userDoc.data()?.fullName ?? uid;

    await adminAuth.updateUser(uid, { disabled });

    await logAuditEvent({
      actorUid: session.uid,
      actorEmail: session.email ?? 'unknown',
      actorRole: 'admin',
      action: disabled ? 'user.suspend' : 'user.reactivate',
      targetType: 'user',
      targetId: uid,
      targetLabel: fullName,
      details: null,
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Failed to update user status:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/** Shared guard for GET and DELETE: admin session, and the uid must be a
 *  patient — never an admin or doctor login. Returns an error response
 *  or the acting admin's uid. */
async function guardPatientRequest(uid: string): Promise<NextResponse | { actorUid: string }> {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }
  if (await isNonPatientUid(uid)) {
    return NextResponse.json(
      { error: 'This account belongs to an admin or doctor and cannot be deleted here.' },
      { status: 403 }
    );
  }
  return { actorUid: session.uid };
}

/** Deletion preview: what will be removed, and what the admin must type
 *  to confirm. Reads only. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const { uid } = await params;
  const guard = await guardPatientRequest(uid);
  if (guard instanceof NextResponse) return guard;

  try {
    const preview = await getDeletionPreview(uid);
    return NextResponse.json(preview);
  } catch (err: unknown) {
    console.error('Failed to build deletion preview:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const { uid } = await params;
  const guard = await guardPatientRequest(uid);
  if (guard instanceof NextResponse) return guard;

  const body = await req.json().catch(() => null);
  const confirmValue: unknown = body?.confirmValue;

  try {
    const identity = await getPatientIdentity(uid);
    if (!identity.confirmBy) {
      // No username, email, profile or login left to confirm against —
      // either everything is already deleted or the uid never existed.
      return NextResponse.json({ error: 'Nothing left to delete for this account.' }, { status: 404 });
    }

    // Server-side re-check of the typed confirmation (username, or email
    // when the patient has no username), case-insensitive — the UI
    // requires it too, but a raw API call can never bypass it here.
    if (!confirmationMatches(identity, confirmValue)) {
      return NextResponse.json(
        {
          error: `Confirmation ${identity.confirmBy} does not match. Deletion cancelled.`,
          confirmBy: identity.confirmBy,
        },
        { status: 400 }
      );
    }

    const result = await deletePatient(uid, guard.actorUid);
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (err: unknown) {
    console.error('Failed to delete user:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
