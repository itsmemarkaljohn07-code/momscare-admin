import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { getAdminSession } from '@/lib/get-admin-session';
import { logAuditEvent } from '@/lib/audit-log';

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

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const { uid } = await params;
  const { confirmName } = await req.json();

  try {
    const userDoc = await adminDb.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    // Server-side re-verification of the typed-name confirmation — the
    // UI already requires this, but re-checking here means a raw API
    // call can never bypass it.
    const realName: string = userDoc.data()?.fullName ?? '';
    if (!confirmName || confirmName.trim() !== realName.trim()) {
      return NextResponse.json(
        { error: 'Confirmation name does not match. Deletion cancelled.' },
        { status: 400 }
      );
    }

    // Firestore does NOT cascade-delete subcollections when a parent
    // document is deleted — recursiveDelete() is the Admin SDK's
    // purpose-built tool for this, and it walks every nested
    // subcollection (appointments, health, healthLogs, notifications,
    // checklist, snapshots, and each snapshot's own comments
    // sub-subcollection) automatically, so nothing is left orphaned.
    await adminDb.recursiveDelete(adminDb.collection('users').doc(uid));

    // The username→email mapping is a separate top-level document,
    // outside users/{uid}, so recursiveDelete above doesn't reach it —
    // removed explicitly here so a deleted patient's username becomes
    // available for reuse instead of staying permanently reserved.
    const usernamesSnap = await adminDb
      .collection('usernames')
      .where('uid', '==', uid)
      .get();
    for (const doc of usernamesSnap.docs) {
      await doc.ref.delete();
    }

    // Firestore deletion above never touches the actual Firebase Auth
    // account — this removes it separately, so the person can no
    // longer sign in at all once deleted.
    try {
      await adminAuth.deleteUser(uid);
    } catch (authErr) {
      // Firestore data is already gone at this point — report the
      // partial failure honestly rather than claiming full success.
      console.error('Firestore data deleted, but Auth account removal failed:', authErr);
      return NextResponse.json(
        { error: 'Account data was deleted, but the login account itself could not be removed. Please check manually.' },
        { status: 500 }
      );
    }

    await logAuditEvent({
      actorUid: session.uid,
      actorEmail: session.email ?? 'unknown',
      actorRole: 'admin',
      action: 'user.delete',
      targetType: 'user',
      targetId: uid,
      targetLabel: realName,
      details: null,
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Failed to delete user:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}