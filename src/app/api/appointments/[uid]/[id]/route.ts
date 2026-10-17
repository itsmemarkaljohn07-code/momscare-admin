import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getAdminSession } from '@/lib/get-admin-session';
import { Timestamp } from 'firebase-admin/firestore';
import { logAuditEvent } from '@/lib/audit-log';
import { isAccentColor, isIcon } from '@/lib/appointment-requests';

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
  // The form no longer edits the card's icon and colour; an edit may only
  // set a valid one, never clear or break the one already stored.
  if (!isIcon(body.icon)) delete body.icon;
  if (!isAccentColor(body.accentColor)) delete body.accentColor;

  try {
    const docRef = adminDb.collection('users').doc(uid).collection('appointments').doc(id);

    // Read and write in one transaction so a change made a moment ago
    // (cancelled, completed or marked missed by someone else) can't be
    // overwritten. Only an upcoming appointment can be edited, completed
    // or cancelled. beforeData describes the appointment in the audit log
    // even if the edit itself changes its label/date/time.
    const outcome = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(docRef);
      if (!snap.exists) return { kind: 'not_found' as const };
      const beforeData = snap.data() ?? {};
      if (beforeData.status !== 'upcoming') return { kind: 'closed' as const };
      tx.update(docRef, { ...body, updatedAt: Timestamp.now() });
      return { kind: 'saved' as const, beforeData };
    });

    if (outcome.kind === 'not_found') {
      return NextResponse.json({ error: 'Appointment not found.' }, { status: 404 });
    }
    if (outcome.kind === 'closed') {
      return NextResponse.json(
        { error: "This appointment is already missed, cancelled or completed and can't be changed." },
        { status: 409 }
      );
    }
    const { beforeData } = outcome;

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