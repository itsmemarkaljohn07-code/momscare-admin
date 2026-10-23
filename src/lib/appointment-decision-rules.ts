// Pure rules for approving or declining an appointment that waits for the
// doctor, shared by the doctor's own route and the admin's backup route.
// No Firebase imports, so it can be unit-tested with plain Node.

import { appointmentName, isMissedAppointment } from '@/lib/appointment-status';

export type Decision = 'approved' | 'rejected';

/** Who recorded a decision; stored on the appointment only for the admin. */
export interface DecidedBy {
  role: 'admin';
  uid: string;
}

/** Longest decline reason the admin route stores. */
export const DECLINE_REASON_MAX = 500;

export const NO_LONGER_DECIDABLE = 'This appointment can no longer be approved or declined.';

/** A decline reason as plain text: control characters removed, spaces
 *  trimmed, at most DECLINE_REASON_MAX characters. Empty means none. */
export function cleanDeclineReason(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const text = raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  return text.slice(0, DECLINE_REASON_MAX).trim();
}

/** "approve" / "decline" from a request body, or null. */
export function parseDecision(raw: unknown): Decision | null {
  return raw === 'approve' ? 'approved' : raw === 'decline' ? 'rejected' : null;
}

/**
 * Why the admin can't decide this appointment, or null when they can:
 * it must still be upcoming, not past its missed time, and still waiting
 * for the doctor.
 */
export function adminDecisionBlock(
  a: { status?: unknown; date?: unknown; time?: unknown; doctor?: unknown; doctorApproval?: unknown; decidedBy?: unknown },
  now: Date
): string | null {
  const status = String(a.status ?? '');
  const appt = { date: String(a.date ?? ''), time: String(a.time ?? ''), status };
  if (status !== 'upcoming' || isMissedAppointment(appt, now)) return NO_LONGER_DECIDABLE;

  const approval = String(a.doctorApproval ?? 'pending');
  if (approval === 'pending') return null;
  const verb = approval === 'approved' ? 'approved' : approval === 'rejected' ? 'declined' : null;
  if (!verb) return NO_LONGER_DECIDABLE;
  const byAdmin = (a.decidedBy as { role?: unknown } | null | undefined)?.role === 'admin';
  const who = byAdmin ? 'The clinic' : String(a.doctor ?? '').trim() || 'The doctor';
  return `${who} already ${verb} this appointment.`;
}

/** The patient's bell + push for a decision. The wording is the doctor
 *  route's, unchanged; the doctor named is the appointment's doctor. */
export function patientDecisionNotice(input: {
  appointmentId: string;
  decision: Decision;
  doctorName: string;
  label: unknown;
  date: unknown;
  time: unknown;
  /** As the doctor route has always passed it: the raw reason, if any. */
  reason?: string | null;
  changedAtMs: number;
}) {
  const isApproved = input.decision === 'approved';
  return {
    type: isApproved ? ('appointment_approved' as const) : ('appointment_declined' as const),
    refId: input.appointmentId,
    route: '/appointments' as const,
    icon: isApproved ? '✅' : '❌',
    bellTitle: isApproved ? 'Appointment Approved' : 'Appointment Declined',
    bellMessage: isApproved
      ? `${input.doctorName} approved your ${appointmentName(input.label as string)} on ${input.date} at ${input.time}.`
      : `${input.doctorName} declined your ${appointmentName(input.label as string)}.${input.reason ? ` Reason: ${input.reason}` : ''}`,
    pushTitle: isApproved ? 'Appointment Approved' : 'Appointment Update',
    pushBody: isApproved
      ? 'Good news, Mommy! Your doctor has approved your appointment. Tap to view the details.'
      : 'Mommy, your doctor has updated your appointment. Open MomCare to view the details.',
    id: `appointment_${input.appointmentId}_${input.decision}_${input.changedAtMs}`,
  };
}

export const CLINIC_DECISION_TITLE = 'Decided by the clinic';
export const CLINIC_DECISION_LINK = '/doctor/appointments';

/** Deterministic id: one doctor entry per appointment and decision. */
export function clinicDecisionNoticeId(appointmentId: string, decision: Decision): string {
  return `clinic-decision-${appointmentId}-${decision}`;
}

/** The doctor's bell line when the admin decided on her behalf. */
export function clinicDecisionMessage(input: {
  decision: Decision;
  label: unknown;
  patientName: string;
  date: unknown;
  time: unknown;
}): string {
  const verb = input.decision === 'approved' ? 'approved' : 'declined';
  return `The clinic ${verb} ${appointmentName(input.label as string)} for ${input.patientName} on ${input.date} at ${input.time} on your behalf.`;
}

/** Audit details for an admin decision: who it was for, never the reason. */
export function onBehalfOf(doctorName: unknown): string {
  return `On behalf of ${String(doctorName ?? '').trim() || 'the doctor'}`;
}
