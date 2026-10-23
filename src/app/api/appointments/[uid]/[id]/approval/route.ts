import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/get-admin-session';
import { logAuditEvent } from '@/lib/audit-log';
import { decideAppointment, sendDecisionNotices, type DecisionActor } from '@/lib/decide-appointment';
import { cleanDeclineReason, onBehalfOf, parseDecision } from '@/lib/appointment-decision-rules';

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * Admin only. POST { decision: 'approve' | 'decline', reason? }: the
 * clinic records the doctor's answer for an appointment still waiting for
 * her, as a backup when she can't open her dashboard. Same core as the
 * doctor's route (decide-appointment.ts); only an upcoming, not yet
 * missed, still pending appointment can be decided (409 otherwise, with a
 * plain message). The patient gets the usual notice once, the doctor one
 * bell entry, and the audit log "On behalf of {doctor}" (never the reason).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ uid: string; id: string }> }) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const { uid, id } = await params;
  const body = await req.json().catch(() => null);
  const decision = parseDecision(body?.decision);
  if (!decision || !ID_PATTERN.test(uid) || !ID_PATTERN.test(id)) {
    return NextResponse.json({ error: 'Choose approve or decline.' }, { status: 400 });
  }
  const reason = decision === 'rejected' ? cleanDeclineReason(body?.reason) : '';

  try {
    const actor: DecisionActor = { role: 'admin', uid: session.uid };
    const outcome = await decideAppointment({ uid, id, decision, reason, actor });

    if (outcome.kind === 'not_found') {
      return NextResponse.json({ error: 'Appointment not found.' }, { status: 404 });
    }
    if (outcome.kind !== 'saved') {
      const message = outcome.kind === 'closed' ? outcome.message : 'This appointment can no longer be approved or declined.';
      return NextResponse.json({ error: message }, { status: 409 });
    }

    const appt = outcome.data;
    await logAuditEvent({
      actorUid: session.uid,
      actorEmail: session.email ?? 'unknown',
      actorRole: 'admin',
      action: decision === 'approved' ? 'appointment.approve' : 'appointment.decline',
      targetType: 'appointment',
      targetId: id,
      targetLabel: `${appt.label || 'Appointment'} — ${appt.date ?? ''} ${appt.time ?? ''}`.trim(),
      details: onBehalfOf(appt.doctor),
    });

    await sendDecisionNotices({ uid, id, decision, reason, actor, outcome });

    return NextResponse.json({ success: true, doctorApproval: decision });
  } catch (err: unknown) {
    console.error('Failed to record admin approval:', (err as { code?: unknown })?.code ?? (err as Error)?.message ?? 'unknown');
    return NextResponse.json({ error: 'Could not save the decision. Please try again.' }, { status: 500 });
  }
}
