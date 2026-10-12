import { getMessaging } from 'firebase-admin/messaging';
import { Timestamp, type DocumentReference } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { buildPushMessage, type PatientNotificationType, type PushRoute } from '@/lib/push-message';

export interface NotifyPatientInput {
  uid: string;
  type: PatientNotificationType;
  /** Appointment id, or the photo id for a snapshot comment. */
  refId: string;
  route: PushRoute;
  bellTitle: string;
  bellMessage: string;
  /** Shown next to the entry in the app's bell list. */
  icon?: string;
  pushTitle: string;
  pushBody: string;
  /** Deterministic bell document id: the same event always maps to the
   *  same id, so a retry or duplicate request can't notify twice. */
  id: string;
}

export interface NotifyPatientResult {
  bell: 'created' | 'duplicate' | 'failed';
  push:
    | 'sent'
    | 'not_attempted'
    | 'opted_out'
    | 'account_unavailable'
    | 'no_devices'
    | 'failed';
  sent: number;
  failed: number;
  removedTokens: number;
}

/** FCM errors that mean the token itself is dead, so the device doc can go. */
const DEAD_TOKEN_CODES = ['registration-token-not-registered', 'invalid-registration-token'];

function isAlreadyExists(err: unknown): boolean {
  const code = (err as { code?: unknown })?.code;
  return code === 6 || code === 'already-exists';
}

function errorCode(err: unknown): string {
  const code = (err as { code?: unknown })?.code;
  return typeof code === 'string' || typeof code === 'number' ? String(code) : 'unknown';
}

/**
 * Records an in-app bell entry for one patient and, if it is new, sends a
 * push to their phones.
 *
 * Call only after the change it describes has been saved. Never throws:
 * the saved change must not be affected by a notification failure. Logs
 * carry the type and counts only, never names, messages or tokens.
 */
export async function notifyPatient(input: NotifyPatientInput): Promise<NotifyPatientResult> {
  const result: NotifyPatientResult = {
    bell: 'failed',
    push: 'not_attempted',
    sent: 0,
    failed: 0,
    removedTokens: 0,
  };
  const userRef = adminDb.collection('users').doc(input.uid);

  try {
    await userRef.collection('notifications').doc(input.id).create({
      type: input.type,
      ...(input.icon ? { icon: input.icon } : {}),
      title: input.bellTitle,
      message: input.bellMessage,
      route: input.route,
      refId: input.refId,
      read: false,
      createdAt: Timestamp.now(),
    });
    result.bell = 'created';
  } catch (err) {
    if (isAlreadyExists(err)) {
      result.bell = 'duplicate';
    } else {
      console.error(`[notify] bell write failed type=${input.type} code=${errorCode(err)}`);
    }
    // Duplicate: this event was already handled. Failed: no push either,
    // so the phone never shows something the bell doesn't have.
    return result;
  }

  try {
    const [profile, devices, authUser] = await Promise.all([
      userRef.get(),
      userRef.collection('devices').get(),
      adminAuth.getUser(input.uid).catch(() => null),
    ]);

    if (profile.data()?.notificationPrefs?.clinicUpdates === false) {
      result.push = 'opted_out';
      return result;
    }
    // A suspended or deleted account can't clean up its own device docs.
    if (!authUser || authUser.disabled) {
      result.push = 'account_unavailable';
      return result;
    }

    const refsByToken = new Map<string, DocumentReference[]>();
    for (const d of devices.docs) {
      const token = d.data().token;
      if (typeof token !== 'string' || !token) continue;
      refsByToken.set(token, [...(refsByToken.get(token) ?? []), d.ref]);
    }
    const tokens = [...refsByToken.keys()];
    if (tokens.length === 0) {
      result.push = 'no_devices';
      return result;
    }

    const response = await getMessaging().sendEachForMulticast({
      tokens,
      ...buildPushMessage({
        type: input.type,
        refId: input.refId,
        route: input.route,
        title: input.pushTitle,
        body: input.pushBody,
      }),
    });
    result.sent = response.successCount;
    result.failed = response.failureCount;

    const dead: DocumentReference[] = [];
    const otherCodes = new Set<string>();
    response.responses.forEach((r, i) => {
      if (r.success) return;
      const code = r.error?.code ?? 'unknown';
      if (DEAD_TOKEN_CODES.some((c) => code.endsWith(c))) {
        dead.push(...(refsByToken.get(tokens[i]) ?? []));
      } else {
        otherCodes.add(code);
      }
    });

    if (dead.length > 0) {
      const removals = await Promise.allSettled(dead.map((ref) => ref.delete()));
      result.removedTokens = removals.filter((r) => r.status === 'fulfilled').length;
    }

    result.push = result.sent > 0 ? 'sent' : 'failed';
    console.log(
      `[notify] push type=${input.type} sent=${result.sent} failed=${result.failed} removed=${result.removedTokens}` +
        (otherCodes.size > 0 ? ` errors=${[...otherCodes].join(',')}` : '')
    );
  } catch (err) {
    result.push = 'failed';
    console.error(`[notify] push failed type=${input.type} code=${errorCode(err)}`);
  }

  return result;
}
