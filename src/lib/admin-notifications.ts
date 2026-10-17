import { FieldPath, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { appointmentName } from '@/lib/appointment-status';
import {
  NOTIFICATION_TTL_MS,
  appointmentRequestNotification,
  cancellationRequestNotification,
  doctorDecisionNotification,
  withinWindow,
  type AdminNotificationDraft,
  type RequestOption,
} from '@/lib/admin-notification-rules';

// One shared admin bell: adminNotifications/{id}, the same list for every
// admin, with read state per admin in readBy {uid: true}. Only the server
// reads or writes it (Admin SDK, behind getAdminSession), so no client
// rule exists for it and clients stay denied by default. It is a separate
// collection from auditLogs, and nothing here ever touches auditLogs.

const LIST_LIMIT = 50;
const MARK_LIMIT = 100;
/** Expired records deleted per sweep run, across both bells. */
const PURGE_CAP = 200;
const BATCH_SIZE = 100;

export interface AdminNotificationView {
  id: string;
  title: string;
  message: string;
  link: string;
  read: boolean;
  createdAt: string | null;
}

function adminCol() {
  return adminDb.collection('adminNotifications');
}

// A duplicate create() reports ALREADY_EXISTS as gRPC code 6, or as HTTP
// 409 over the REST transport this project uses (preferRest).
function isAlreadyExists(err: unknown): boolean {
  const code = (err as { code?: unknown })?.code;
  return code === 6 || code === 409 || code === 'already-exists';
}

function errorCode(err: unknown): string {
  return String((err as { code?: unknown })?.code ?? 'unknown');
}

function millis(v: unknown): number | null {
  return v instanceof Timestamp ? v.toMillis() : null;
}

/** Creates the record unless it already exists. Never throws. */
export async function createAdminNotification(
  draft: AdminNotificationDraft
): Promise<'created' | 'duplicate' | 'failed'> {
  const ref = adminCol().doc(draft.id);
  try {
    await ref.create({
      type: draft.type,
      title: draft.title,
      message: draft.message,
      link: draft.link,
      appointmentId: draft.appointmentId,
      patientUid: draft.patientUid,
      readBy: {},
      createdAt: FieldValue.serverTimestamp(),
      // Provisional, from this machine's clock; replaced just below.
      expiresAt: Timestamp.fromMillis(Date.now() + NOTIFICATION_TTL_MS),
    });
  } catch (err) {
    if (isAlreadyExists(err)) return 'duplicate';
    console.error(`[admin-notifications] create failed (non-fatal): ${errorCode(err)}`);
    return 'failed';
  }
  // expiresAt exactly 7 days after the server's createdAt (this machine's
  // clock may differ from Firestore's). If this fails the provisional
  // value stays, a few seconds off at most.
  try {
    const createdAt = (await ref.get()).get('createdAt');
    if (createdAt instanceof Timestamp) {
      await ref.update({ expiresAt: Timestamp.fromMillis(createdAt.toMillis() + NOTIFICATION_TTL_MS) });
    }
  } catch (err) {
    console.error(`[admin-notifications] expiry update failed (non-fatal): ${errorCode(err)}`);
  }
  return 'created';
}

async function patientNames(uids: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const unique = [...new Set(uids)];
  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const refs = unique.slice(i, i + BATCH_SIZE).map((uid) => adminDb.collection('users').doc(uid));
    const docs = await adminDb.getAll(...refs, { fieldMask: ['fullName'] });
    for (const d of docs) names.set(d.id, String(d.get('fullName') ?? '').trim() || 'A patient');
  }
  return names;
}

/** Every event of the last 7 days that should have a bell record. */
async function collectDrafts(nowMs: number): Promise<AdminNotificationDraft[]> {
  // Plain collection-group reads of a few fields (no index needed), the
  // same approach as the missed-appointment sweep.
  const [requests, appointments] = await Promise.all([
    adminDb.collectionGroup('appointmentRequests').select('type', 'options', 'createdAt').get(),
    adminDb
      .collectionGroup('appointments')
      .select('label', 'date', 'time', 'doctor', 'doctorApproval', 'doctorApprovalAt', 'cancellation')
      .get(),
  ]);

  type Pending =
    | { kind: 'request'; uid: string; id: string; type: string; options: RequestOption[] }
    | { kind: 'decision'; uid: string; id: string; decision: 'approved' | 'rejected'; at: number; doctor: string; label: string; date: string; time: string }
    | { kind: 'cancel'; uid: string; id: string; at: number; label: string; date: string; time: string };
  const pending: Pending[] = [];

  for (const d of requests.docs) {
    const uid = d.ref.parent.parent?.id;
    if (!uid || !withinWindow(millis(d.get('createdAt')), nowMs)) continue;
    const options = d.get('options');
    pending.push({
      kind: 'request',
      uid,
      id: d.id,
      type: String(d.get('type') ?? ''),
      options: Array.isArray(options) ? options : [],
    });
  }

  for (const d of appointments.docs) {
    const uid = d.ref.parent.parent?.id;
    if (!uid) continue;
    const label = appointmentName(d.get('label'));
    const date = String(d.get('date') ?? '');
    const time = String(d.get('time') ?? '');

    const decision = d.get('doctorApproval');
    const decidedAt = millis(d.get('doctorApprovalAt'));
    if ((decision === 'approved' || decision === 'rejected') && withinWindow(decidedAt, nowMs)) {
      pending.push({ kind: 'decision', uid, id: d.id, decision, at: decidedAt as number, doctor: String(d.get('doctor') ?? ''), label, date, time });
    }

    const cancellation = d.get('cancellation');
    const requestedAt = millis(cancellation?.requestedAt);
    if (cancellation?.state === 'requested' && withinWindow(requestedAt, nowMs)) {
      pending.push({ kind: 'cancel', uid, id: d.id, at: requestedAt as number, label, date, time });
    }
  }

  const names = await patientNames(pending.map((p) => p.uid));
  return pending.map((p) => {
    const patientName = names.get(p.uid) ?? 'A patient';
    if (p.kind === 'request') {
      return appointmentRequestNotification({ patientUid: p.uid, requestId: p.id, patientName, type: p.type, options: p.options });
    }
    if (p.kind === 'decision') {
      return doctorDecisionNotification({
        patientUid: p.uid, appointmentId: p.id, decision: p.decision, decidedAtMs: p.at,
        doctorName: p.doctor, patientName, appointmentLabel: p.label, date: p.date, time: p.time,
      });
    }
    return cancellationRequestNotification({
      patientUid: p.uid, appointmentId: p.id, requestedAtMs: p.at,
      patientName, appointmentLabel: p.label, date: p.date, time: p.time,
    });
  });
}

export interface AdminNotificationSyncResult {
  eventsFound: number;
  missing: number;
  created: number;
  failed: number;
}

/**
 * Finds patient appointment requests, doctor approvals/declines and
 * cancellation requests from the last 7 days and creates any missing
 * bell record. The phone writes requests and cancellations straight to
 * Firestore, so this check is how the dashboard learns of them. Fixed
 * ids make re-runs harmless. With dryRun it only counts.
 */
export async function syncAdminNotifications({ dryRun }: { dryRun: boolean }): Promise<AdminNotificationSyncResult> {
  const result: AdminNotificationSyncResult = { eventsFound: 0, missing: 0, created: 0, failed: 0 };
  const drafts = await collectDrafts(Date.now());
  result.eventsFound = drafts.length;
  if (drafts.length === 0) return result;

  const existing = new Set<string>();
  for (let i = 0; i < drafts.length; i += BATCH_SIZE) {
    const docs = await adminDb.getAll(
      ...drafts.slice(i, i + BATCH_SIZE).map((d) => adminCol().doc(d.id)),
      { fieldMask: [] }
    );
    docs.forEach((d) => d.exists && existing.add(d.id));
  }
  const missing = drafts.filter((d) => !existing.has(d.id));
  result.missing = missing.length;
  if (dryRun) return result;

  for (const draft of missing) {
    const outcome = await createAdminNotification(draft);
    if (outcome === 'created') result.created++;
    else if (outcome === 'failed') result.failed++;
  }
  if (result.created > 0) console.log(`[admin-notifications] created=${result.created}`);
  return result;
}

// While an admin has the dashboard open, the bell asks for a check every
// minute; across tabs and admins this instance runs it at most that often.
const SYNC_MIN_INTERVAL_MS = 60_000;
let lastSyncAt = 0;

/** The bell's check: at most once a minute per server instance. Never throws. */
export async function syncAdminNotificationsThrottled(): Promise<void> {
  if (Date.now() - lastSyncAt < SYNC_MIN_INTERVAL_MS) return;
  lastSyncAt = Date.now();
  try {
    await syncAdminNotifications({ dryRun: false });
  } catch (err) {
    console.error(`[admin-notifications] sync failed (non-fatal): ${errorCode(err)}`);
  }
}

export async function listAdminNotifications(
  adminUid: string
): Promise<{ notifications: AdminNotificationView[]; unreadCount: number }> {
  const snap = await adminCol().orderBy('createdAt', 'desc').limit(LIST_LIMIT).get();
  const notifications = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      title: data.title,
      message: data.message,
      link: data.link,
      read: data.readBy?.[adminUid] === true,
      createdAt: data.createdAt?.toDate?.().toISOString() ?? null,
    };
  });
  return { notifications, unreadCount: notifications.filter((n) => !n.read).length };
}

/** Marks records read for this admin only; other admins keep their state. */
export async function markAdminNotificationsRead(
  adminUid: string,
  target: { ids: string[] } | { all: true }
): Promise<number> {
  const docs =
    'all' in target
      ? (await adminCol().orderBy('createdAt', 'desc').limit(MARK_LIMIT).get()).docs
      : (await adminDb.getAll(...target.ids.map((id) => adminCol().doc(id)))).filter((d) => d.exists);
  const unread = docs.filter((d) => d.get('readBy')?.[adminUid] !== true);
  if (unread.length === 0) return 0;
  const batch = adminDb.batch();
  unread.forEach((d) => batch.update(d.ref, new FieldPath('readBy', adminUid), true));
  await batch.commit();
  return unread.length;
}

export interface PurgeResult {
  adminDue: number;
  doctorDue: number;
  deleted: number;
  capped: boolean;
}

/**
 * Deletes bell records older than 7 days: expired adminNotifications and
 * doctors/{id}/notifications by createdAt. At most PURGE_CAP per run, in
 * batches; the next run continues. Only these two exact collection paths
 * are read or deleted, never auditLogs. With dryRun it only counts.
 */
export async function purgeOldNotifications({ dryRun }: { dryRun: boolean }): Promise<PurgeResult> {
  const now = Timestamp.now();
  const cutoff = Timestamp.fromMillis(now.toMillis() - NOTIFICATION_TTL_MS);
  const result: PurgeResult = { adminDue: 0, doctorDue: 0, deleted: 0, capped: false };

  const adminOld = await adminCol().where('expiresAt', '<=', now).limit(PURGE_CAP).select().get();
  result.adminDue = adminOld.size;
  const refs = adminOld.docs.map((d) => d.ref);

  const doctors = await adminDb.collection('doctors').select().get();
  for (const doctor of doctors.docs) {
    const room = PURGE_CAP - refs.length;
    if (room <= 0) {
      result.capped = true;
      break;
    }
    const old = await doctor.ref
      .collection('notifications')
      .where('createdAt', '<', cutoff)
      .limit(room)
      .select()
      .get();
    result.doctorDue += old.size;
    old.docs.forEach((d) => refs.push(d.ref));
  }
  if (refs.length >= PURGE_CAP) result.capped = true;
  if (dryRun) return result;

  for (let i = 0; i < refs.length; i += BATCH_SIZE) {
    const batch = adminDb.batch();
    refs.slice(i, i + BATCH_SIZE).forEach((ref) => batch.delete(ref));
    await batch.commit();
    result.deleted += Math.min(BATCH_SIZE, refs.length - i);
  }
  return result;
}
