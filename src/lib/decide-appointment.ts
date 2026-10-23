import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { notifyPatient } from '@/lib/notify-patient';
import { appointmentName } from '@/lib/appointment-status';
import { createAdminNotification } from '@/lib/admin-notifications';
import { doctorDecisionNotification } from '@/lib/admin-notification-rules';
import { notifyDoctorOfClinicDecision } from '@/lib/doctor-notifications';
import { readOwnedSlotLock, releaseSlotLock } from '@/lib/slot-locks';
import { adminDecisionBlock, patientDecisionNotice, type Decision } from '@/lib/appointment-decision-rules';

// The one place an appointment's doctor approval is decided: the doctor's
// own route and the admin's backup route both call decideAppointment, then
// sendDecisionNotices, so the two can't drift apart.

export type DecisionActor =
  | { role: 'doctor'; uid: string; doctorName: string }
  | { role: 'admin'; uid: string };

export type DecisionOutcome =
  | { kind: 'not_found' }
  /** Doctor only: the appointment is another doctor's. */
  | { kind: 'forbidden' }
  /** Not upcoming any more (doctor), or not decidable any more (admin). */
  | { kind: 'closed'; message: string }
  | { kind: 'saved'; data: FirebaseFirestore.DocumentData; changed: boolean; changedAt: Timestamp };

/**
 * Reads and writes in one transaction, so only a real change of
 * doctorApproval (not a repeat or a double-click) notifies anyone.
 *
 * Doctor: exactly the doctor route's long-standing rules: only her own
 * appointments, only while upcoming; a repeat is saved without notifying.
 *
 * Admin: only while upcoming, before its missed time, and still pending,
 * so a decision is never taken twice whichever side acts. Records
 * decidedBy, and a decline frees the doctor's slot.
 */
export async function decideAppointment(input: {
  uid: string;
  id: string;
  decision: Decision;
  /** Doctor: stored as sent. Admin: already cleaned (cleanDeclineReason). */
  reason?: string | null;
  actor: DecisionActor;
}): Promise<DecisionOutcome> {
  const { uid, id, decision, reason, actor } = input;
  const docRef = adminDb.collection('users').doc(uid).collection('appointments').doc(id);

  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    if (!snap.exists) return { kind: 'not_found' as const };
    const data = snap.data() ?? {};

    if (actor.role === 'doctor') {
      // Security: a doctor can only act on appointments actually
      // assigned to them — verified against the doctor field stored on
      // the appointment itself, not just trusted from the request.
      const storedDoctor = (data.doctor ?? '').trim().toLowerCase();
      const sessionDoctor = (actor.doctorName ?? '').trim().toLowerCase();
      if (!storedDoctor || storedDoctor !== sessionDoctor) return { kind: 'forbidden' as const };
      // Only an upcoming appointment can be approved or declined: once it
      // is cancelled, completed or missed (possibly a moment ago, by an
      // admin or the sweep) nothing is written and nobody is notified.
      if (data.status !== 'upcoming') {
        return { kind: 'closed' as const, message: 'This appointment is already cancelled, completed or missed.' };
      }

      const changed = (data.doctorApproval ?? 'pending') !== decision;
      const changedAt = Timestamp.now();
      tx.update(docRef, {
        doctorApproval: decision,
        rejectionReason: decision === 'rejected' ? (reason ?? '') : null,
        ...(changed ? { doctorApprovalAt: changedAt } : {}),
        // A doctor's own change replaces an earlier admin decision.
        ...(changed && data.decidedBy ? { decidedBy: FieldValue.delete() } : {}),
      });
      return { kind: 'saved' as const, data, changed, changedAt };
    }

    const block = adminDecisionBlock(data, new Date());
    if (block) return { kind: 'closed' as const, message: block };

    // Reads first (Firestore transaction rule), then writes.
    const owned = decision === 'rejected' ? await readOwnedSlotLock(tx, docRef, data) : null;
    const changedAt = Timestamp.now();
    tx.update(docRef, {
      doctorApproval: decision,
      rejectionReason: decision === 'rejected' ? (reason ?? '') : null,
      doctorApprovalAt: changedAt,
      decidedBy: { role: 'admin', uid: actor.uid },
      // Declined: the doctor's slot is free again.
      ...(decision === 'rejected' ? releaseSlotLock(tx, owned) : {}),
    });
    return { kind: 'saved' as const, data, changed: true, changedAt };
  });
}

/**
 * Notices for a saved decision that really changed it; never throws, so
 * the saved decision is never affected. The patient gets the same bell +
 * push either way (the decline reason stays in the bell, never the push).
 * Doctor decision: the admin bell entry, as before. Admin decision: one
 * entry in the doctor's bell instead (the admins already know).
 */
export async function sendDecisionNotices(input: {
  uid: string;
  id: string;
  decision: Decision;
  reason?: string | null;
  actor: DecisionActor;
  outcome: Extract<DecisionOutcome, { kind: 'saved' }>;
}): Promise<void> {
  const { uid, id, decision, reason, actor, outcome } = input;
  if (!outcome.changed) return;
  const appt = outcome.data;
  const doctorName = actor.role === 'doctor' ? actor.doctorName : String(appt.doctor ?? '').trim();

  await notifyPatient({
    uid,
    ...patientDecisionNotice({
      appointmentId: id,
      decision,
      doctorName,
      label: appt.label,
      date: appt.date,
      time: appt.time,
      reason,
      changedAtMs: outcome.changedAt.toMillis(),
    }),
  });

  const patient = await adminDb.collection('users').doc(uid).get().catch(() => null);
  const patientName = String(patient?.get('fullName') ?? '').trim() || 'A patient';

  if (actor.role === 'doctor') {
    // Admin bell: one record per real change. Never throws; the sweep
    // creates it later if this write is lost.
    await createAdminNotification(
      doctorDecisionNotification({
        patientUid: uid,
        appointmentId: id,
        decision,
        decidedAtMs: outcome.changedAt.toMillis(),
        doctorName: actor.doctorName,
        patientName,
        appointmentLabel: appointmentName(appt.label),
        date: String(appt.date ?? ''),
        time: String(appt.time ?? ''),
      })
    );
    return;
  }

  await notifyDoctorOfClinicDecision({
    appointmentId: id,
    patientUid: uid,
    doctorName,
    decision,
    patientName,
    label: appt.label,
    date: String(appt.date ?? ''),
    time: String(appt.time ?? ''),
  });
}
