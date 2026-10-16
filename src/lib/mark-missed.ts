import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { appointmentName, isMissedAppointment } from '@/lib/appointment-status';
import { clearPendingCancellationCountCache } from '@/lib/get-appointments';
import { notifyPatient } from '@/lib/notify-patient';

export type MarkMissedOutcome = 'marked' | 'not_missed' | 'not_found' | 'forbidden';

/**
 * Stores status "missed" on an appointment that is still upcoming
 * MISSED_AFTER_MS (3 hours) or more after its start, then notifies the
 * patient (bell entry + push, once: the bell id is fixed per appointment).
 *
 * Shared by the staff route (a page that is open) and the scheduled sweep,
 * so both behave the same. The status and time are re-checked inside a
 * transaction, so a repeated or early call changes nothing. When
 * `doctorName` is given, only that doctor's own appointments are changed.
 */
export async function markAppointmentMissed(
  uid: string,
  id: string,
  options: { doctorName?: string } = {}
): Promise<MarkMissedOutcome> {
  const docRef = adminDb.collection('users').doc(uid).collection('appointments').doc(id);

  const outcome = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    if (!snap.exists) return { kind: 'not_found' as const };
    const data = snap.data() ?? {};

    if (options.doctorName !== undefined) {
      const storedDoctor = (data.doctor ?? '').trim().toLowerCase();
      const sessionDoctor = options.doctorName.trim().toLowerCase();
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

  if (outcome.kind !== 'marked') return outcome.kind;

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

  return 'marked';
}
