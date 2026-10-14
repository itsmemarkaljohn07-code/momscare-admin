// No firebase-admin imports here, so a script can build and dry-run the
// exact payload without loading the app's Admin SDK setup.

/** Android channel the phone app creates for care-team pushes. */
export const PUSH_CHANNEL_ID = 'momcare-updates';

export type PatientNotificationType =
  | 'appointment_created'
  | 'appointment_approved'
  | 'appointment_declined'
  | 'doctor_comment'
  | 'cancellation_update'
  | 'appointment_missed';

/** Routes the phone app opens from a tapped push; anything else is ignored. */
export type PushRoute = '/home' | '/appointments' | '/snapshot';

export interface PushContent {
  type: PatientNotificationType;
  refId: string;
  route: PushRoute;
  /** Generic text only: no names, no medical details, no comment text. */
  title: string;
  body: string;
}

/** The FCM message for one patient's devices. The phone app reads
 *  data.photoId (not refId) to open a specific snapshot, so it is sent as
 *  well for /snapshot. All data values must be strings. */
export function buildPushMessage(content: PushContent) {
  const data: Record<string, string> = {
    route: content.route,
    type: content.type,
    refId: content.refId,
  };
  if (content.route === '/snapshot') data.photoId = content.refId;

  return {
    notification: { title: content.title, body: content.body },
    data,
    android: {
      priority: 'high' as const,
      notification: { channelId: PUSH_CHANNEL_ID },
    },
  };
}
