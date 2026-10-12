// Shared by server fetches and client listeners, so no Firebase imports
// here — both the Admin SDK and the client SDK Timestamps expose
// toDate(), which is all the mapping needs.

export type CancellationState = 'requested' | 'withdrawn' | 'declined' | 'approved';

/** Cancellation request written by the patient app onto the appointment. */
export interface AppointmentCancellation {
  state: CancellationState;
  reason?: string;
  requestedAt: string | null;
  decidedAt?: string | null;
  decidedBy?: string;
  declineReason?: string;
}

const STATES: readonly CancellationState[] = ['requested', 'withdrawn', 'declined', 'approved'];

export const DECLINE_REASON_MAX = 300;

function toIso(value: unknown): string | null {
  if (value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof value === 'string') return value;
  return null;
}

/** Converts the raw Firestore `cancellation` map into a plain,
 *  serialisable object. Returns undefined when it is missing or has an
 *  unknown state, so callers can treat "no request" uniformly. */
export function mapCancellation(raw: unknown): AppointmentCancellation | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const data = raw as Record<string, unknown>;
  if (!STATES.includes(data.state as CancellationState)) return undefined;

  const result: AppointmentCancellation = {
    state: data.state as CancellationState,
    requestedAt: toIso(data.requestedAt),
  };
  if (typeof data.reason === 'string' && data.reason) result.reason = data.reason;
  if (data.decidedAt != null) result.decidedAt = toIso(data.decidedAt);
  if (typeof data.decidedBy === 'string' && data.decidedBy) result.decidedBy = data.decidedBy;
  if (typeof data.declineReason === 'string' && data.declineReason) {
    result.declineReason = data.declineReason;
  }
  return result;
}

/** An open request the admin still has to decide on. */
export function isCancellationRequested(a: {
  status: string;
  cancellation?: AppointmentCancellation;
}): boolean {
  return a.status === 'upcoming' && a.cancellation?.state === 'requested';
}
