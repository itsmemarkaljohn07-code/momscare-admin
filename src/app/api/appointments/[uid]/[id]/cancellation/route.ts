import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getAdminSession } from '@/lib/get-admin-session';
import { FieldValue, Timestamp, type DocumentData } from 'firebase-admin/firestore';
import { logAuditEvent } from '@/lib/audit-log';
import { DECLINE_REASON_MAX } from '@/lib/appointment-cancellation';
import { clearPendingCancellationCountCache } from '@/lib/get-appointments';
import { notifyPatient } from '@/lib/notify-patient';
import { appointmentName } from '@/lib/appointment-status';

type Decision = 'approve' | 'decline';

type TxResult =
  | { kind: 'not_found' }
  | { kind: 'already_cancelled' }
  | { kind: 'conflict'; message: string }
  | { kind: 'done'; data: DocumentData; decidedAt: Timestamp };

function conflictMessage(status: unknown, state: unknown): string {
  if (status === 'completed') return 'This appointment is already completed, so it can no longer be cancelled.';
  if (status !== 'upcoming') return 'This appointment is not upcoming, so the request cannot be decided.';
  switch (state) {
    case 'withdrawn': return 'The patient has withdrawn this cancellation request.';
    case 'declined': return 'This cancellation request has already been declined.';
    case 'approved': return 'This cancellation request has already been approved.';
    default: return 'There is no open cancellation request for this appointment.';
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string; id: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const { uid, id } = await params;
  const body = await req.json().catch(() => null);
  const decision: Decision | undefined =
    body?.decision === 'approve' || body?.decision === 'decline' ? body.decision : undefined;

  if (!decision) {
    return NextResponse.json({ error: "Decision must be 'approve' or 'decline'." }, { status: 400 });
  }
  if (body.reason !== undefined && body.reason !== null && typeof body.reason !== 'string') {
    return NextResponse.json({ error: 'Reason must be text.' }, { status: 400 });
  }
  const declineReason = decision === 'decline' ? (body.reason ?? '').trim() : '';
  if (declineReason.length > DECLINE_REASON_MAX) {
    return NextResponse.json(
      { error: `Reason must be ${DECLINE_REASON_MAX} characters or fewer.` },
      { status: 400 }
    );
  }

  try {
    const docRef = adminDb.collection('users').doc(uid).collection('appointments').doc(id);

    // Read and write in one transaction so a patient withdrawing the
    // request (or another admin deciding it) at the same moment can't
    // be overwritten. The Admin SDK bypasses rules, so the checks here
    // are the only guard.
    const result = await adminDb.runTransaction<TxResult>(async (tx) => {
      const snap = await tx.get(docRef);
      if (!snap.exists) return { kind: 'not_found' };

      const data = snap.data() ?? {};
      if (data.status === 'cancelled') return { kind: 'already_cancelled' };
      if (data.status !== 'upcoming' || data.cancellation?.state !== 'requested') {
        return { kind: 'conflict', message: conflictMessage(data.status, data.cancellation?.state) };
      }

      const now = Timestamp.now();
      if (decision === 'approve') {
        tx.update(docRef, {
          status: 'cancelled',
          'cancellation.state': 'approved',
          'cancellation.decidedAt': now,
          'cancellation.decidedBy': session.uid,
          updatedAt: now,
        });
      } else {
        tx.update(docRef, {
          'cancellation.state': 'declined',
          // Cleared when empty so a reason from an earlier decision never lingers.
          'cancellation.declineReason': declineReason || FieldValue.delete(),
          'cancellation.decidedAt': now,
          'cancellation.decidedBy': session.uid,
          updatedAt: now,
        });
      }
      return { kind: 'done', data, decidedAt: now };
    });

    if (result.kind === 'not_found') {
      return NextResponse.json({ error: 'Appointment not found.' }, { status: 404 });
    }
    if (result.kind === 'already_cancelled') {
      return NextResponse.json({
        success: true,
        alreadyCancelled: true,
        message: 'This appointment was already cancelled. Nothing was changed.',
      });
    }
    if (result.kind === 'conflict') {
      return NextResponse.json({ error: result.message }, { status: 409 });
    }

    // The decision is saved; drop the cached count so the sidebar badge
    // is correct on the router.refresh() that follows.
    clearPendingCancellationCountCache();

    const { data, decidedAt } = result;
    const isApprove = decision === 'approve';
    const when = `${data.date ?? ''} at ${data.time ?? ''}`.trim();

    await logAuditEvent({
      actorUid: session.uid,
      actorEmail: session.email ?? 'unknown',
      actorRole: 'admin',
      action: isApprove ? 'appointment.cancel_approve' : 'appointment.cancel_decline',
      targetType: 'appointment',
      targetId: id,
      targetLabel: `${data.label ?? 'Appointment'} — ${data.date ?? ''} ${data.time ?? ''}`.trim(),
      // The patient's own reason is not copied into the audit log.
      // Nor the clinic's free-text reason: it can name health details.
      details: isApprove ? null : declineReason ? 'Declined with a reason' : 'Declined without a reason',
    });

    // The decision above has already been saved; notifyPatient never
    // throws, so it is not rolled back if this fails. The transaction
    // guarantees this is a real requested -> approved/declined change.
    await notifyPatient({
      uid,
      type: 'cancellation_update',
      refId: id,
      route: '/appointments',
      icon: isApprove ? '✅' : '❌',
      bellTitle: isApprove ? 'Cancellation Approved' : 'Cancellation Declined',
      bellMessage: isApprove
        ? `Your request to cancel your ${appointmentName(data.label)} on ${when} was approved. The appointment is now cancelled.`
        : `Your request to cancel your ${appointmentName(data.label)} on ${when} was declined, so the appointment is still scheduled.${declineReason ? ` Reason: ${declineReason}` : ''}`,
      pushTitle: 'Cancellation Update',
      pushBody: 'Mommy, there is an update on your cancellation request. Open MomCare to view the details.',
      id: `cancellation_${id}_${isApprove ? 'approved' : 'declined'}_${decidedAt.toMillis()}`,
    });

    return NextResponse.json({
      success: true,
      message: isApprove ? 'Cancellation approved. The patient has been notified.' : 'Cancellation request declined. The patient has been notified.',
    });
  } catch (err: unknown) {
    console.error('Failed to decide cancellation request:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
