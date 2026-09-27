import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getDoctorSession } from '@/lib/get-doctor-session';
import { Timestamp } from 'firebase-admin/firestore';
import { logAuditEvent } from '@/lib/audit-log';

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
    const snap = await docRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Appointment not found.' }, { status: 404 });
    }
    // Security: a doctor can only act on appointments actually
    // assigned to them — verified against the doctor field stored on
    // the appointment itself, not just trusted from the request.
    const storedDoctor = (snap.data()?.doctor ?? '').trim().toLowerCase();
    const sessionDoctor = (session.doctorName ?? '').trim().toLowerCase();
    if (!storedDoctor || storedDoctor !== sessionDoctor) {
      return NextResponse.json({ error: 'Not your appointment.' }, { status: 403 });
    }

    await docRef.update({
      doctorApproval,
      rejectionReason: doctorApproval === 'rejected' ? (rejectionReason ?? '') : null,
    });

    const apptData = snap.data() ?? {};

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

    // Best-effort in-app notification for the patient — uses the
    // Admin SDK, so this bypasses rules entirely (unlike the doctor
    // comment thread's client-side write, which needed a rules
    // change). If this fails for any reason, the approval/decline
    // above already succeeded and is not rolled back — the
    // notification is a nice-to-have, not the actual action.
    try {
      const label = apptData.label || 'appointment';
      const isApproved = doctorApproval === 'approved';
      await adminDb.collection('users').doc(uid).collection('notifications').add({
        icon: isApproved ? '✅' : '❌',
        title: isApproved ? 'Appointment Approved' : 'Appointment Declined',
        message: isApproved
          ? `${session.doctorName} approved your ${label} appointment on ${apptData.date} at ${apptData.time}.`
          : `${session.doctorName} declined your ${label} appointment.${rejectionReason ? ` Reason: ${rejectionReason}` : ''}`,
        read: false,
        route: null,
        createdAt: Timestamp.now(),
      });
    } catch (notifyErr) {
      console.error('Failed to create appointment notification (non-fatal):', notifyErr);
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