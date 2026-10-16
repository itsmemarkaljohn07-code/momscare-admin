import { NextRequest, NextResponse, after } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getAdminSession } from '@/lib/get-admin-session';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { notifyPatient } from '@/lib/notify-patient';
import { notifyDoctorOfNewAppointment } from '@/lib/doctor-notifications';

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const body = await req.json();
  const { patientUid, ...appt } = body;

  if (!patientUid) {
    return NextResponse.json({ error: 'A patient must be selected.' }, { status: 400 });
  }

  try {
        const docRef = await adminDb
      .collection('users')
      .doc(patientUid)
      .collection('appointments')
        .add({
        ...appt,
        userId: patientUid,
        status: 'upcoming',
        doctorApproval: 'pending',
        createdAt: Timestamp.now(),
      });

    // Denormalized onto the patient's own doc so Firestore security
    // rules can cheaply verify "is this doctor allowed to see this
    // patient's photos/comments" without an expensive relationship
    // query — rules can't scan subcollections, only check known paths.
    await adminDb.collection('users').doc(patientUid).set(
      { assignedDoctorNames: FieldValue.arrayUnion(appt.doctor) },
      { merge: true }
    );

    // Saved; tell the patient. Keyed on the new appointment's id.
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