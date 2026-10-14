import { NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { getAdminSession } from '@/lib/get-admin-session';
import { getDoctorSession } from '@/lib/get-doctor-session';
import { appointmentName, isMissedAppointment } from '@/lib/appointment-status';
import { clearPendingCancellationCountCache } from '@/lib/get-appointments';
import { notifyPatient } from '@/lib/notify-patient';

/**
 * Stores status "missed" on an appointment that is still upcoming more
 * than 30 minutes after its start time, then notifies the patient (bell
 * entry + push, once). Called by the dashboard pages (useMarkMissed) while
 * an admin or doctor has one open. Everything is checked again here, so a
 * repeated or early request changes nothing.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ uid: string; id: string }> }
) {
  const admin = await getAdminSession();
  const doctor = admin ? null : await getDoctorSession();
  if (!admin && !doctor) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const { uid, id } = await params;

  try {
    const docRef = adminDb.collection('users').doc(uid).collection('appointments').doc(id);

    const outcome = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(docRef);
      if (!snap.exists) return { kind: 'not_found' as const };
      const data = snap.data() ?? {};

      // A doctor may only mark appointments assigned to them (same check
      // as the doctor approval route).
      if (doctor) {
        const storedDoctor = (data.doctor ?? '').trim().toLowerCase();
        const sessionDoctor = (doctor.doctorName ?? '').trim().toLowerCase();
        if (!storedDoctor || storedDoctor !== sessionDoctor) return { kind: 'forbidden' as const };
      }

      const appt = { date: String(data.date ?? ''), time: String(data.time ?? ''), status: String(data.status ?? '') };
      if (appt.status !== 'upcoming' || !isMissedAppointment(appt, new Date())) {
        return { kind: 'not_missed' as const };
      }

      const now = Timestamp.now();
      tx.update(docRef, { status: 'missed', missedAt: now, updatedAt: now });
      return { kind: 'marked' as const, data };
    });

    if (outcome.kind === 'not_found') {
      return NextResponse.json({ error: 'Appointment not found.' }, { status: 404 });
    }
    if (outcome.kind === 'forbidden') {
      return NextResponse.json({ error: 'Not your appointment.' }, { status: 403 });
    }
    if (outcome.kind === 'not_missed') {
      return NextResponse.json({ success: true, changed: false });
    }

    // An open cancellation request on it no longer counts as pending.
    clearPendingCancellationCountCache();

    const { data } = outcome;
    const withDoctor = data.doctor ? ` with ${data.doctor}` : '';
    const when = `${data.date ?? ''} at ${data.time ?? ''}`.trim();

    // Saved above; notifyPatient never throws, and its fixed id means the
    // patient is notified only once for this appointment.
    await notifyPatient({
      uid,
      type: 'appointment_missed',
      refId: id,
      route: '/appointments',
      icon: '⏰',
      bellTitle: 'Missed Appointment',
      bellMessage: `You missed your ${appointmentName(data.label)}${withDoctor} on ${when}. Please contact the clinic to rebook.`,
      pushTitle: 'Missed Appointment',
      pushBody: 'Mommy, it looks like you missed an appointment. Open MomCare to view the details.',
      id: `missed_${id}`,
    });

    return NextResponse.json({ success: true, changed: true });
  } catch (err: unknown) {
    console.error('Failed to mark appointment as missed:', err);
    return NextResponse.json({ error: 'Could not mark the appointment as missed.' }, { status: 500 });
  }
}
