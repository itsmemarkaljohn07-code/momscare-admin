import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getDoctorSession } from '@/lib/get-doctor-session';
import { Timestamp } from 'firebase-admin/firestore';
import { logAuditEvent } from '@/lib/audit-log';
import { notifyPatient } from '@/lib/notify-patient';
import { appointmentName } from '@/lib/appointment-status';
import { createAdminNotification } from '@/lib/admin-notifications';
import { doctorDecisionNotification } from '@/lib/admin-notification-rules';

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
    const docRef = adminDb.collection('users').doc(uid).collection('appointments').doc(id);

    // Compare and write in one transaction, so only a real change of
    // doctorApproval (not a repeat or a double-click) notifies the
    // patient. doctorApprovalAt is stored only on such a change.
    const outcome = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(docRef);
      if (!snap.exists) return { kind: 'not_found' as const };
      // Security: a doctor can only act on appointments actually
      // assigned to them — verified against the doctor field stored on
      // the appointment itself, not just trusted from the request.
      const storedDoctor = (snap.data()?.doctor ?? '').trim().toLowerCase();
      const sessionDoctor = (session.doctorName ?? '').trim().toLowerCase();
      if (!storedDoctor || storedDoctor !== sessionDoctor) return { kind: 'forbidden' as const };

      const data = snap.data() ?? {};
      // Only an upcoming appointment can be approved or declined: once it
      // is cancelled, completed or missed (possibly a moment ago, by an
      // admin or the sweep) nothing is written and nobody is notified.
      if (data.status !== 'upcoming') return { kind: 'closed' as const };

      const changed = (data.doctorApproval ?? 'pending') !== doctorApproval;
      const changedAt = Timestamp.now();
      tx.update(docRef, {
        doctorApproval,
        rejectionReason: doctorApproval === 'rejected' ? (rejectionReason ?? '') : null,
        ...(changed ? { doctorApprovalAt: changedAt } : {}),
      });
      return { kind: 'saved' as const, data, changed, changedAt };
    });

    if (outcome.kind === 'not_found') {
      return NextResponse.json({ error: 'Appointment not found.' }, { status: 404 });
    }
    if (outcome.kind === 'forbidden') {
      return NextResponse.json({ error: 'Not your appointment.' }, { status: 403 });
    }
    if (outcome.kind === 'closed') {
      return NextResponse.json(
        { error: 'This appointment is already cancelled, completed or missed.' },
        { status: 409 }
      );
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
      details: doctorApproval === 'rejected' ? (rejectionReason || null) : null,
    });

    // Bell + push only on a real change; never throws, so the saved
    // approval/decline above is never affected. The decline reason
    // stays in the in-app bell only, never in the push.
    if (outcome.changed) {
      const isApproved = doctorApproval === 'approved';
      await notifyPatient({
        uid,
        type: isApproved ? 'appointment_approved' : 'appointment_declined',
        refId: id,
        route: '/appointments',
        icon: isApproved ? '✅' : '❌',
        bellTitle: isApproved ? 'Appointment Approved' : 'Appointment Declined',
        bellMessage: isApproved
          ? `${session.doctorName} approved your ${appointmentName(apptData.label)} on ${apptData.date} at ${apptData.time}.`
          : `${session.doctorName} declined your ${appointmentName(apptData.label)}.${rejectionReason ? ` Reason: ${rejectionReason}` : ''}`,
        pushTitle: isApproved ? 'Appointment Approved' : 'Appointment Update',
        pushBody: isApproved
          ? 'Good news, Mommy! Your doctor has approved your appointment. Tap to view the details.'
          : 'Mommy, your doctor has updated your appointment. Open MomCare to view the details.',
        id: `appointment_${id}_${doctorApproval}_${outcome.changedAt.toMillis()}`,
      });

      // Admin bell: one record per real change. Never throws; the sweep
      // creates it later if this write is lost.
      const patient = await adminDb.collection('users').doc(uid).get().catch(() => null);
      await createAdminNotification(
        doctorDecisionNotification({
          patientUid: uid,
          appointmentId: id,
          decision: isApproved ? 'approved' : 'rejected',
          decidedAtMs: outcome.changedAt.toMillis(),
          doctorName: session.doctorName,
          patientName: String(patient?.get('fullName') ?? '').trim() || 'A patient',
          appointmentLabel: appointmentName(apptData.label),
          date: String(apptData.date ?? ''),
          time: String(apptData.time ?? ''),
        })
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Failed to update appointment approval:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}