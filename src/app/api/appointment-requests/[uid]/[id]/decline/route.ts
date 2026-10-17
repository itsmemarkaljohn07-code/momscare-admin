import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { getAdminSession } from '@/lib/get-admin-session';
import { notifyPatient } from '@/lib/notify-patient';
import { logAuditEvent } from '@/lib/audit-log';
import {
  ADMIN_NOTE_MAX,
  REQUEST_PUSH_BODY,
  REQUEST_PUSH_TITLE,
  requestDeclinedBellMessage,
  requestNotificationId,
} from '@/lib/appointment-requests';

/** Declines a patient's pending appointment request, with an optional note
 *  the patient sees in the app. Only a pending request can be declined;
 *  the patient is told once (bell + push, fixed id, no medical details). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string; id: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const { uid, id } = await params;
  const body = await req.json().catch(() => ({}));
  const note = typeof body?.note === 'string' ? body.note.trim() : '';
  if (note.length > ADMIN_NOTE_MAX) {
    return NextResponse.json(
      { error: `Keep the note under ${ADMIN_NOTE_MAX} characters.` },
      { status: 400 }
    );
  }

  try {
    const requestRef = adminDb.collection('users').doc(uid).collection('appointmentRequests').doc(id);
    const outcome = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(requestRef);
      if (!snap.exists) return { kind: 'not_found' as const };
      const request = snap.data() ?? {};
      if (request.status !== 'pending') return { kind: 'closed' as const };
      tx.update(requestRef, {
        status: 'declined',
        ...(note ? { adminNote: note } : {}),
        declinedAt: Timestamp.now(),
        declinedBy: session.uid,
      });
      return { kind: 'declined' as const, type: typeof request.type === 'string' ? request.type : 'Appointment' };
    });

    if (outcome.kind === 'not_found') {
      return NextResponse.json({ error: 'Request not found.' }, { status: 404 });
    }
    if (outcome.kind === 'closed') {
      return NextResponse.json(
        { error: 'This request was already scheduled, declined or withdrawn.' },
        { status: 409 }
      );
    }

    // Only reached when this call really declined a pending request (a
    // repeat gets 409 above), and notifyPatient never throws, so a failed
    // notice can't undo the decline. The note goes in the bell, never the push.
    await notifyPatient({
      uid,
      type: 'appointment_request_declined',
      refId: id,
      route: '/appointments',
      icon: '📅',
      bellTitle: REQUEST_PUSH_TITLE,
      bellMessage: requestDeclinedBellMessage(outcome.type, note),
      pushTitle: REQUEST_PUSH_TITLE,
      pushBody: REQUEST_PUSH_BODY,
      id: requestNotificationId(id, 'declined'),
    });

    await logAuditEvent({
      actorUid: session.uid,
      actorEmail: session.email ?? 'unknown',
      actorRole: 'admin',
      action: 'appointment_request.decline',
      targetType: 'appointment_request',
      targetId: id,
      targetLabel: `${outcome.type} request`,
      details: note ? 'Declined with a note' : 'Declined without a note',
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Failed to decline appointment request:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
