// The one patient notice for "your appointment was cancelled", shared by
// every path that cancels an appointment (admin Cancel, an approved
// cancellation request). Its id is fixed per appointment, so whichever path
// cancels it, and however often a request is retried, the patient is told
// once. Text and id rules: appointment-cancelled-rules.ts.

import { notifyPatient } from '@/lib/notify-patient';
import {
  CANCELLED_PUSH_BODY,
  CANCELLED_PUSH_TITLE,
  cancelledBellMessage,
  cancelledNoticeId,
  type CancelledBy,
} from '@/lib/appointment-cancelled-rules';

export { cancelledNoticeId, type CancelledBy };

/**
 * Tells the patient (bell + push) that an appointment was cancelled. Call
 * only after a write that really moved it from upcoming to cancelled.
 * Never throws (notifyPatient doesn't), so the cancellation is never undone.
 */
export async function notifyAppointmentCancelled(input: {
  uid: string;
  appointmentId: string;
  data: { label?: unknown; date?: unknown; time?: unknown };
  by: CancelledBy;
}): Promise<void> {
  await notifyPatient({
    uid: input.uid,
    // The app shows type cancellation_update with ✅ as "cancelled".
    type: 'cancellation_update',
    refId: input.appointmentId,
    route: '/appointments',
    icon: '✅',
    bellTitle: CANCELLED_PUSH_TITLE,
    bellMessage: cancelledBellMessage(input.data.label, input.data.date, input.data.time, input.by),
    pushTitle: CANCELLED_PUSH_TITLE,
    pushBody: CANCELLED_PUSH_BODY,
    id: cancelledNoticeId(input.appointmentId),
  });
}
