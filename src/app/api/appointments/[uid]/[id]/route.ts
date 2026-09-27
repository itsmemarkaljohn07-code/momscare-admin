import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getAdminSession } from '@/lib/get-admin-session';
import { Timestamp } from 'firebase-admin/firestore';
import { logAuditEvent } from '@/lib/audit-log';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string; id: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const { uid, id } = await params;
  const body = await req.json();

  try {
    const docRef = adminDb.collection('users').doc(uid).collection('appointments').doc(id);

    // Fetched before the update so the log entry describes the
    // appointment even if the edit itself changes its label/date/time.
    const beforeSnap = await docRef.get();
    const beforeData = beforeSnap.data() ?? {};

    await docRef.update({ ...body, updatedAt: Timestamp.now() });

    const isStatusOnly = 'status' in body && Object.keys(body).length === 1;

    await logAuditEvent({
      actorUid: session.uid,
      actorEmail: session.email ?? 'unknown',
      actorRole: 'admin',
      action: isStatusOnly ? 'appointment.status_change' : 'appointment.edit',
      targetType: 'appointment',
      targetId: id,
      targetLabel: `${beforeData.label ?? 'Appointment'} — ${beforeData.date ?? ''} ${beforeData.time ?? ''}`.trim(),
      details: isStatusOnly ? `Status changed to ${body.status}` : null,
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Failed to update appointment:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string; id: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const { uid, id } = await params;

  try {
    const docRef = adminDb.collection('users').doc(uid).collection('appointments').doc(id);
    const snap = await docRef.get();

    if (!snap.exists) {
      return NextResponse.json({ error: 'Appointment not found.' }, { status: 404 });
    }

    const data = snap.data() ?? {};
    const status = data.status;
    if (status !== 'completed' && status !== 'cancelled') {
      return NextResponse.json(
        { error: 'Only completed or cancelled appointments can be deleted.' },
        { status: 400 }
      );
    }

    await docRef.delete();

    await logAuditEvent({
      actorUid: session.uid,
      actorEmail: session.email ?? 'unknown',
      actorRole: 'admin',
      action: 'appointment.delete',
      targetType: 'appointment',
      targetId: id,
      targetLabel: `${data.label ?? 'Appointment'} — ${data.date ?? ''}`.trim(),
      details: null,
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Failed to delete appointment:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}