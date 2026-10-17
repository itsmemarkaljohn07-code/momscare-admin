import { NextRequest, NextResponse, after } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getAdminSession } from '@/lib/get-admin-session';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { notifyPatient } from '@/lib/notify-patient';
import { notifyDoctorOfNewAppointment } from '@/lib/doctor-notifications';
import { logAuditEvent } from '@/lib/audit-log';
import { appearanceFor } from '@/lib/appointment-requests';

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const body = await req.json();
  // requestId (scheduling a patient's request) is never stored on the
  // appointment; icon and accentColor are filled in below.
  const { patientUid, requestId, icon, accentColor, ...appt } = body;

  if (!patientUid) {
    return NextResponse.json({ error: 'A patient must be selected.' }, { status: 400 });
  }
  if (requestId !== undefined && (typeof requestId !== 'string' || !requestId)) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  try {
    const patientRef = adminDb.collection('users').doc(patientUid);
    const docRef = patientRef.collection('appointments').doc();
    const fields = {
      ...appt,
      userId: patientUid,
      status: 'upcoming',
      doctorApproval: 'pending',
      createdAt: Timestamp.now(),
    };

    if (requestId) {
      // Scheduling a request: create the appointment and mark the request
      // scheduled together, and only while it is still pending, so the
      // same request can never become two appointments.
      const requestRef = patientRef.collection('appointmentRequests').doc(requestId);
      const outcome = await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(requestRef);
        if (!snap.exists) return 'not_found' as const;
        const request = snap.data() ?? {};
        if (request.status !== 'pending') return 'closed' as const;
        tx.create(docRef, { ...fields, ...appearanceFor(appt.label, request) });
        tx.update(requestRef, {
          status: 'scheduled',
          appointmentId: docRef.id,
          scheduledAt: Timestamp.now(),
          scheduledBy: session.uid,
        });
        return 'scheduled' as const;
      });
      if (outcome === 'not_found') {
        return NextResponse.json({ error: 'Request not found.' }, { status: 404 });
      }
      if (outcome === 'closed') {
        return NextResponse.json(
          { error: 'This request was already scheduled, declined or withdrawn.' },
          { status: 409 }
        );
      }
    } else {
      await docRef.set({ ...fields, ...appearanceFor(appt.label, { icon, accentColor }) });
    }

    // Denormalized onto the patient's own doc so Firestore security
    // rules can cheaply verify "is this doctor allowed to see this
    // patient's photos/comments" without an expensive relationship
    // query — rules can't scan subcollections, only check known paths.
    await patientRef.set(
      { assignedDoctorNames: FieldValue.arrayUnion(appt.doctor) },
      { merge: true }
    );

    // Saved; tell the patient. Keyed on the new appointment's id. A
    // scheduled request sends only this, no separate request notice.
    await notifyPatient({
      uid: patientUid,
      type: 'appointment_created',
      refId: docRef.id,
      route: '/appointments',
      icon: '📅',
      bellTitle: 'New Appointment Scheduled',
      bellMessage: `A new ${appt.label || 'appointment'} has been scheduled for you on ${appt.date} at ${appt.time}.`,
      pushTitle: 'New Appointment Scheduled',
      pushBody: 'Mommy, a new appointment has been scheduled for you. Tap to view the details.',
      id: `appointment_created_${docRef.id}`,
    });

    if (requestId) {
      await logAuditEvent({
        actorUid: session.uid,
        actorEmail: session.email ?? 'unknown',
        actorRole: 'admin',
        action: 'appointment_request.schedule',
        targetType: 'appointment_request',
        targetId: requestId,
        targetLabel: `${appt.label ?? 'Appointment'} — ${appt.date ?? ''} ${appt.time ?? ''}`.trim(),
        details: `Scheduled as appointment ${docRef.id} with ${appt.doctor ?? 'a doctor'}`,
      });
    }

    // Tell the assigned doctor on their dashboard bell. Runs after the
    // response is sent, so it can never fail or slow the create.
    const appointmentId = docRef.id;
    after(() =>
      notifyDoctorOfNewAppointment({
        appointmentId,
        patientUid,
        doctorName: appt.doctor,
        doctorId: typeof appt.doctorId === 'string' ? appt.doctorId : null,
        date: appt.date,
        time: appt.time,
      })
    );

    return NextResponse.json({ success: true, id: docRef.id });
  } catch (err: unknown) {
    console.error('Failed to create appointment:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
