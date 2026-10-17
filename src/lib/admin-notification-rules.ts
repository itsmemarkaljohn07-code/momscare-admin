// Pure rules for the admin bell (adminNotifications/{id}): which events
// become a notification, their fixed ids and their wording. No Firebase
// imports, so it can be unit-tested with plain Node.
//
// Messages carry the patient's name, the appointment type and the date and
// time only: never reasons, notes or other health data.

export const NOTIFICATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** The Requests tab of the Appointments page. */
export const REQUESTS_LINK = '/admin/appointments?tab=requests';

export type AdminNotificationType =
  | 'appointment_request'
  | 'doctor_approved'
  | 'doctor_declined'
  | 'cancellation_requested';

export interface AdminNotificationDraft {
  id: string;
  type: AdminNotificationType;
  title: string;
  message: string;
  link: string;
  appointmentId: string;
  patientUid: string;
}

/** Firestore ids may not contain '/'; everything else used here is safe. */
function part(s: string): string {
  return s.replace(/\//g, '_');
}

export interface RequestOption {
  date?: unknown;
  from?: unknown;
  to?: unknown;
}

/** A patient's request at users/{uid}/appointmentRequests/{requestId}. */
export function appointmentRequestNotification(input: {
  patientUid: string;
  requestId: string;
  patientName: string;
  type: string;
  options: RequestOption[];
}): AdminNotificationDraft {
  const first = input.options[0] ?? {};
  const when =
    typeof first.date === 'string' && typeof first.from === 'string' && typeof first.to === 'string'
      ? ` for ${first.date}, ${first.from}–${first.to}`
      : '';
  return {
    id: `req_${part(input.patientUid)}_${part(input.requestId)}`,
    type: 'appointment_request',
    title: 'New appointment request',
    message: `${input.patientName} requested a ${input.type || 'appointment'}${when}.`,
    link: REQUESTS_LINK,
    appointmentId: input.requestId,
    patientUid: input.patientUid,
  };
}

/** A doctor's approve/decline; one per real change (its time is in the id). */
export function doctorDecisionNotification(input: {
  patientUid: string;
  appointmentId: string;
  decision: 'approved' | 'rejected';
  decidedAtMs: number;
  doctorName: string;
  patientName: string;
  appointmentLabel: string;
  date: string;
  time: string;
}): AdminNotificationDraft {
  const approved = input.decision === 'approved';
  return {
    id: `${approved ? 'appr' : 'decl'}_${part(input.patientUid)}_${part(input.appointmentId)}_${input.decidedAtMs}`,
    type: approved ? 'doctor_approved' : 'doctor_declined',
    title: approved ? 'Doctor approved an appointment' : 'Doctor declined an appointment',
    message: `${input.doctorName || 'The doctor'} ${approved ? 'approved' : 'declined'} ${input.patientName}'s ${input.appointmentLabel} on ${input.date} at ${input.time}.`,
    link: '/admin/appointments',
    appointmentId: input.appointmentId,
    patientUid: input.patientUid,
  };
}

/** A patient asked to cancel; one per request (its time is in the id). */
export function cancellationRequestNotification(input: {
  patientUid: string;
  appointmentId: string;
  requestedAtMs: number;
  patientName: string;
  appointmentLabel: string;
  date: string;
  time: string;
}): AdminNotificationDraft {
  return {
    id: `cxl_${part(input.patientUid)}_${part(input.appointmentId)}_${input.requestedAtMs}`,
    type: 'cancellation_requested',
    title: 'Cancellation request',
    message: `${input.patientName} asked to cancel the ${input.appointmentLabel} on ${input.date} at ${input.time}.`,
    link: '/admin/appointments',
    appointmentId: input.appointmentId,
    patientUid: input.patientUid,
  };
}

/** True when the event happened inside the 7-day window the bell shows. */
export function withinWindow(eventMs: number | null, nowMs: number): boolean {
  return eventMs !== null && eventMs >= nowMs - NOTIFICATION_TTL_MS && eventMs <= nowMs + 60_000;
}
