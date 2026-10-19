// Pure text and id rules for the "appointment cancelled" patient notice.
// No Firebase imports, so it can be unit-tested with plain Node.

import { appointmentName } from '@/lib/appointment-status';

export type CancelledBy = 'clinic' | 'doctor' | 'request';

export const CANCELLED_PUSH_TITLE = 'Appointment Cancelled';
/** Generic: shown on a lock screen, so no type, date or names. */
export const CANCELLED_PUSH_BODY = 'Mommy, one of your appointments was cancelled. Open MomCare to view the details.';

export function cancelledNoticeId(appointmentId: string): string {
  return `cancelled_${appointmentId}`;
}

function formatDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? date
    : d.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
}

/** "Your Ultrasound appointment on Feb 3, 2030 at 9:00 AM was cancelled by the clinic." */
export function cancelledBellMessage(label: unknown, date: unknown, time: unknown, by: CancelledBy): string {
  const who = by === 'doctor' ? 'by your doctor' : by === 'request' ? 'at your request' : 'by the clinic';
  const name = appointmentName(typeof label === 'string' ? label : '');
  const when = typeof date === 'string' && date ? ` on ${formatDay(date)}${typeof time === 'string' && time ? ` at ${time}` : ''}` : '';
  return `Your ${name}${when} was cancelled ${who}.`;
}
