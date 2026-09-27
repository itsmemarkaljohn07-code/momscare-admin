import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getAdminSession } from '@/lib/get-admin-session';
import { logAuditEvent } from '@/lib/audit-log';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const { uid } = await params;

  if (uid === session.uid) {
    return NextResponse.json(
      { error: 'You cannot remove your own admin access.' },
      { status: 400 }
    );
  }

  try {
    const adminSnap = await adminDb.collection('admins').doc(uid).get();
    const adminEmail: string = adminSnap.data()?.email ?? uid;

    await adminDb.collection('admins').doc(uid).delete();

    await logAuditEvent({
      actorUid: session.uid,
      actorEmail: session.email ?? 'unknown',
      actorRole: 'admin',
      action: 'admin.remove_access',
      targetType: 'admin',
      targetId: uid,
      targetLabel: adminEmail,
      details: null,
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Failed to remove admin:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}