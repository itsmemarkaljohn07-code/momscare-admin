// Pure rules for audit entries of patient actions taken in the MomCare app
// (appointment requests and cancellation requests). The phone writes these
// straight to Firestore, so the dashboard derives the events from the
// documents' current state. No Firebase imports: unit-testable.
//
// Each event has a fixed document id, so writing it with create() can
// never duplicate it, however often the check runs. Labels carry the
// appointment type and date/time only, never reasons or notes.

export const PATIENT_AUDIT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type PatientAuditAction =
  | 'appointment_request.create'
  | 'appointment_request.withdraw'
  | 'appointment.cancel_request'
  | 'appointment.cancel_withdraw';

export interface PatientAuditEvent {
  /** auditLogs document id. */
  id: string;
  action: PatientAuditAction;
  actorUid: string;
  targetType: 'appointment_request' | 'appointment';
  targetId: string;
  targetLabel: string;
  /** When it happened (ms); the entry's createdAt. */
  at: number;
}

function inWindow(at: number | null, nowMs: number): at is number {
  return at !== null && at >= nowMs - PATIENT_AUDIT_WINDOW_MS && at <= nowMs + 60_000;
}

const part = (s: string) => s.replace(/\//g, '_');

interface RequestOptionLike {
  date?: unknown;
  from?: unknown;
  to?: unknown;
}

function requestLabel(type: string, options: RequestOptionLike[]): string {
  const o = options[0] ?? {};
  const when = typeof o.date === 'string' ? ` — ${o.date}${typeof o.from === 'string' && typeof o.to === 'string' ? ` ${o.from}–${o.to}` : ''}` : '';
  return `${type || 'Appointment'} request${when}`;
}

/** Events for one users/{uid}/appointmentRequests/{id} document. */
export function requestAuditEvents(
  uid: string,
  requestId: string,
  data: { type: string; options: RequestOptionLike[]; status: string; createdAt: number | null; withdrawnAt: number | null },
  nowMs: number
): PatientAuditEvent[] {
  const label = requestLabel(data.type, data.options);
  const base = { actorUid: uid, targetType: 'appointment_request' as const, targetId: requestId, targetLabel: label };
  const out: PatientAuditEvent[] = [];
  if (inWindow(data.createdAt, nowMs)) {
    out.push({ ...base, id: `patient_request_create_${part(uid)}_${part(requestId)}`, action: 'appointment_request.create', at: data.createdAt });
  }
  if (data.status === 'withdrawn' && inWindow(data.withdrawnAt, nowMs)) {
    out.push({ ...base, id: `patient_request_withdraw_${part(uid)}_${part(requestId)}`, action: 'appointment_request.withdraw', at: data.withdrawnAt });
  }
  return out;
}

/**
 * Events for one appointment's `cancellation`. The app writes requestedAt
 * on both a request and a withdrawal, so: state requested / approved /
 * declined -> a cancellation request at requestedAt; state withdrawn -> a
 * withdrawal at requestedAt. (A request withdrawn before any check ran
 * shows only as the withdrawal.)
 */
export function cancellationAuditEvents(
  uid: string,
  appointmentId: string,
  data: { label: string; date: string; time: string; state: unknown; requestedAt: number | null },
  nowMs: number
): PatientAuditEvent[] {
  if (!inWindow(data.requestedAt, nowMs)) return [];
  const base = {
    actorUid: uid,
    targetType: 'appointment' as const,
    targetId: appointmentId,
    targetLabel: `${data.label || 'Appointment'} — ${data.date} ${data.time}`.trim(),
    at: data.requestedAt,
  };
  const key = `${part(uid)}_${part(appointmentId)}_${data.requestedAt}`;
  if (data.state === 'requested' || data.state === 'approved' || data.state === 'declined') {
    return [{ ...base, id: `patient_cancel_request_${key}`, action: 'appointment.cancel_request' }];
  }
  if (data.state === 'withdrawn') {
    return [{ ...base, id: `patient_cancel_withdraw_${key}`, action: 'appointment.cancel_withdraw' }];
  }
  return [];
}
