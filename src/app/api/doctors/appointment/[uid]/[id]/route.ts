import { NextRequest, NextResponse } from 'next/server';
import { getDoctorSession } from '@/lib/get-doctor-session';
import { logAuditEvent } from '@/lib/audit-log';
import { decideAppointment, sendDecisionNotices, type DecisionActor } from '@/lib/decide-appointment';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string; id: string }> }
) {
  const session = await getDoctorSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const { uid, id } = await params;
  const { doctorApproval, rejectionReason } = await req.json();

  if (!['approved', 'rejected'].includes(doctorApproval)) {
    return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
  }

  try {
    // Shared with the admin's backup route (decide-appointment.ts): one
    // transaction, and only a real change of doctorApproval (not a repeat
    // or a double-click) notifies anyone.
    const actor: DecisionActor = { role: 'doctor', uid: session.uid, doctorName: session.doctorName };
    const outcome = await decideAppointment({ uid, id, decision: doctorApproval, reason: rejectionReason, actor });

    if (outcome.kind === 'not_found') {
      return NextResponse.json({ error: 'Appointment not found.' }, { status: 404 });
    }
    if (outcome.kind === 'forbidden') {
      return NextResponse.json({ error: 'Not your appointment.' }, { status: 403 });
    }
    if (outcome.kind === 'closed') {
      return NextResponse.json({ error: outcome.message }, { status: 409 });
    }

    const apptData = outcome.data;

    await logAuditEvent({
      actorUid: session.uid,
      actorEmail: session.doctorName ?? 'unknown',
      actorRole: 'doctor',
      action: doctorApproval === 'approved' ? 'appointment.approve' : 'appointment.decline',
      targetType: 'appointment',
      targetId: id,
      targetLabel: `${apptData.label || 'Appointment'} — ${apptData.date ?? ''} ${apptData.time ?? ''}`.trim(),
      // The doctor's free-text reason stays out of the audit log: it can
      // name health details. The patient still sees it in her bell.
      details: doctorApproval === 'rejected' ? (rejectionReason ? 'Declined with a reason' : 'Declined without a reason') : null,
    });

    // Patient bell + push and the admin bell, only on a real change; never
    // throws, so the saved approval/decline above is never affected.
    await sendDecisionNotices({ uid, id, decision: doctorApproval, reason: rejectionReason, actor, outcome });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Failed to update appointment approval:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
