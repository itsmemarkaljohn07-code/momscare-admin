import { Timestamp, type DocumentData, type DocumentReference } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { patientName as displayName } from '@/lib/patient-name';
import {
  findRepliesForDoctor,
  replyNotificationId,
  type ReplyCommentLike,
} from '@/lib/doctor-reply-detection';
import {
  APPOINTMENT_NOTICE_LINK,
  APPOINTMENT_NOTICE_TITLE,
  appointmentNoticeId,
  appointmentNoticeMessage,
  resolveAppointmentDoctor,
  type DoctorRef,
} from '@/lib/doctor-appointment-notice';
import {
  CLINIC_DECISION_LINK,
  CLINIC_DECISION_TITLE,
  clinicDecisionMessage,
  clinicDecisionNoticeId,
  type Decision,
} from '@/lib/appointment-decision-rules';

// Doctor bell records live at doctors/{doctorId}/notifications/{id}. Only
// the server reads or writes them (Admin SDK, behind getDoctorSession), so
// no client rule exists for them and clients stay denied by default.

const LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_SNAPSHOTS_PER_RUN = 100;
const LIST_LIMIT = 30;

export const REPLY_TITLE = 'New Patient Reply';
export const REPLY_MESSAGE =
  'A patient has replied to your Snapshot comment. Open MomCare to view the conversation.';

export interface DoctorNotificationView {
  id: string;
  title: string;
  message: string;
  link: string;
  read: boolean;
  createdAt: string | null;
}

/** A snapshot thread the doctor's browser listens to for new replies. */
export interface WatchedThread {
  patientUid: string;
  photoId: string;
}

function notificationsCol(doctorId: string) {
  return adminDb.collection('doctors').doc(doctorId).collection('notifications');
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

type CommentRow = ReplyCommentLike & { createdAt: Timestamp | null };

function toRow(id: string, d: DocumentData): CommentRow {
  return {
    id,
    authorRole: d.authorRole,
    authorName: d.authorName ?? null,
    parentCommentId: d.parentCommentId ?? null,
    createdAt: d.createdAt instanceof Timestamp ? d.createdAt : null,
  };
}

/** Applies the reply rule to one snapshot thread's comments from the last
 *  7 days and creates any missing bell records. Returns how many it
 *  created. The caller must already know the patient is assigned. */
async function checkThread(
  doctorId: string,
  doctorName: string,
  patientUid: string,
  snapshotRef: DocumentReference
): Promise<number> {
  const since = Timestamp.fromMillis(Date.now() - LOOKBACK_MS);
  const commentsCol = snapshotRef.collection('comments');
  const recent = await commentsCol.where('createdAt', '>=', since).get();
  if (recent.empty) return 0;

  const rows = recent.docs.map((d) => toRow(d.id, d.data()));
  const replies = rows.filter((r) => r.authorRole === 'user' && r.parentCommentId);
  if (replies.length === 0) return 0;

  // Parents are usually in the recent set; older ones are read by id.
  const parentsById = new Map<string, ReplyCommentLike>(rows.map((r) => [r.id, r]));
  const missing = [...new Set(replies.map((r) => r.parentCommentId as string))].filter(
    (id) => !parentsById.has(id)
  );
  if (missing.length > 0) {
    const parentDocs = await adminDb.getAll(...missing.map((id) => commentsCol.doc(id)));
    for (const p of parentDocs) if (p.exists) parentsById.set(p.id, toRow(p.id, p.data() ?? {}));
  }

  let created = 0;
  for (const reply of findRepliesForDoctor(replies, parentsById, doctorName)) {
    try {
      // create() fails if the record exists, so a reply is only ever
      // recorded once, however many times it is detected.
      await notificationsCol(doctorId).doc(replyNotificationId(reply.id)).create({
        type: 'patient_reply',
        title: REPLY_TITLE,
        message: REPLY_MESSAGE,
        link: `/doctor/${patientUid}?photo=${snapshotRef.id}`,
        patientUid,
        photoId: snapshotRef.id,
        commentId: reply.id,
        read: false,
        createdAt: reply.createdAt ?? Timestamp.now(),
      });
      created++;
    } catch (err) {
      if (!isAlreadyExists(err)) throw err;
    }
  }
  return created;
}

/**
 * Full check, run on every dashboard load: finds patient replies to this
 * doctor's Snapshot comments from the last 7 days and creates one bell
 * record per reply. Only patients still assigned to the doctor are
 * scanned, newest 100 snapshots at most. Uses only single-collection
 * queries on automatic indexes. Never throws.
 *
 * Returns the threads it scanned, for the browser to watch live.
 */
export async function syncDoctorReplyNotifications(
  doctorId: string,
  doctorName: string
): Promise<WatchedThread[]> {
  const watched: WatchedThread[] = [];
  let created = 0;
  try {
    const patients = await adminDb
      .collection('users')
      .where('assignedDoctorNames', 'array-contains', doctorName)
      .select()
      .get();

    let budget = MAX_SNAPSHOTS_PER_RUN;
    for (const patient of patients.docs) {
      if (budget <= 0) break;
      const snapshots = await patient.ref
        .collection('snapshots')
        .orderBy('createdAt', 'desc')
        .limit(budget)
        .select()
        .get();
      budget -= snapshots.size;

      for (const snapshot of snapshots.docs) {
        watched.push({ patientUid: patient.id, photoId: snapshot.id });
        created += await checkThread(doctorId, doctorName, patient.id, snapshot.ref);
      }
    }
    if (created > 0) console.log(`[doctor-notifications] created=${created}`);
  } catch (err) {
    console.error(`[doctor-notifications] reply sync failed (non-fatal): ${errorCode(err)}`);
  }
  return watched;
}

/**
 * Checks a single thread after the browser saw a new patient comment on
 * it. Re-verifies on the server that the patient is still assigned to
 * this doctor, so a request for any other patient does nothing. Never
 * throws.
 */
export async function checkDoctorReplyThread(
  doctorId: string,
  doctorName: string,
  patientUid: string,
  photoId: string
): Promise<void> {
  try {
    const patientRef = adminDb.collection('users').doc(patientUid);
    const patient = await patientRef.get();
    const assigned: unknown = patient.data()?.assignedDoctorNames;
    if (!Array.isArray(assigned) || !assigned.includes(doctorName)) return;

    const created = await checkThread(
      doctorId,
      doctorName,
      patientUid,
      patientRef.collection('snapshots').doc(photoId)
    );
    if (created > 0) console.log(`[doctor-notifications] created=${created}`);
  } catch (err) {
    console.error(`[doctor-notifications] thread check failed (non-fatal): ${errorCode(err)}`);
  }
}

/**
 * One "New appointment to review" entry for the doctor on an appointment
 * an admin just created. The doctor is found by id if given, otherwise by
 * exact name; nothing is created unless exactly one doctor matches. The
 * fixed id appointment-{appointmentId} means a repeat never adds a second
 * entry. Never throws (the appointment is already saved); logs a short
 * code only.
 */
export async function notifyDoctorOfNewAppointment(input: {
  appointmentId: string;
  patientUid: string;
  doctorName?: string | null;
  doctorId?: string | null;
  date: string;
  time: string;
}): Promise<'created' | 'duplicate' | 'no_doctor' | 'failed'> {
  try {
    let candidates: DoctorRef[];
    if (input.doctorId) {
      const snap = await adminDb.collection('doctors').doc(input.doctorId).get();
      candidates = snap.exists ? [{ id: snap.id, name: String(snap.get('name') ?? '') }] : [];
    } else {
      const snap = await adminDb.collection('doctors').select('name').get();
      candidates = snap.docs.map((d) => ({ id: d.id, name: String(d.get('name') ?? '') }));
    }
    const doctor = resolveAppointmentDoctor(candidates, input);
    if (!doctor) return 'no_doctor';

    const patient = await adminDb.collection('users').doc(input.patientUid).get();
    const patientName = displayName(patient.data(), 'A patient');

    try {
      await notificationsCol(doctor.id).doc(appointmentNoticeId(input.appointmentId)).create({
        type: 'appointment_created',
        title: APPOINTMENT_NOTICE_TITLE,
        message: appointmentNoticeMessage(patientName, input.date, input.time),
        link: APPOINTMENT_NOTICE_LINK,
        appointmentId: input.appointmentId,
        patientUid: input.patientUid,
        read: false,
        createdAt: Timestamp.now(),
      });
      return 'created';
    } catch (err) {
      if (isAlreadyExists(err)) return 'duplicate';
      throw err;
    }
  } catch (err) {
    console.error(`[doctor-notifications] appointment notice failed (non-fatal): ${errorCode(err)}`);
    return 'failed';
  }
}

/**
 * One entry telling the doctor that the clinic approved or declined one of
 * her pending appointments on her behalf. The doctor is found by exact
 * name (nothing is created unless exactly one doctor matches); the fixed
 * id clinic-decision-{appointmentId}-{decision} means a repeat never adds
 * a second entry. Never throws; logs a short code only.
 */
export async function notifyDoctorOfClinicDecision(input: {
  appointmentId: string;
  patientUid: string;
  doctorName: string;
  decision: Decision;
  patientName: string;
  label: unknown;
  date: string;
  time: string;
}): Promise<'created' | 'duplicate' | 'no_doctor' | 'failed'> {
  try {
    const snap = await adminDb.collection('doctors').select('name').get();
    const candidates: DoctorRef[] = snap.docs.map((d) => ({ id: d.id, name: String(d.get('name') ?? '') }));
    const doctor = resolveAppointmentDoctor(candidates, { doctorName: input.doctorName });
    if (!doctor) return 'no_doctor';
    try {
      await notificationsCol(doctor.id).doc(clinicDecisionNoticeId(input.appointmentId, input.decision)).create({
        type: input.decision === 'approved' ? 'appointment_approved_by_clinic' : 'appointment_declined_by_clinic',
        title: CLINIC_DECISION_TITLE,
        message: clinicDecisionMessage(input),
        link: CLINIC_DECISION_LINK,
        appointmentId: input.appointmentId,
        patientUid: input.patientUid,
        read: false,
        createdAt: Timestamp.now(),
      });
      return 'created';
    } catch (err) {
      if (isAlreadyExists(err)) return 'duplicate';
      throw err;
    }
  } catch (err) {
    console.error(`[doctor-notifications] clinic decision notice failed (non-fatal): ${errorCode(err)}`);
    return 'failed';
  }
}

/** The newest record's id (one document read), so an open bell can tell
 *  cheaply whether anything new arrived before re-reading the list. */
export async function latestDoctorNotificationId(doctorId: string): Promise<string | null> {
  const snap = await notificationsCol(doctorId).orderBy('createdAt', 'desc').limit(1).select().get();
  return snap.empty ? null : snap.docs[0].id;
}

export async function listDoctorNotifications(
  doctorId: string
): Promise<{ notifications: DoctorNotificationView[]; unreadCount: number }> {
  const col = notificationsCol(doctorId);
  const [list, unread] = await Promise.all([
    col.orderBy('createdAt', 'desc').limit(LIST_LIMIT).get(),
    col.where('read', '==', false).count().get(),
  ]);
  return {
    notifications: list.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        title: data.title,
        message: data.message,
        link: data.link,
        read: data.read === true,
        createdAt: data.createdAt?.toDate?.().toISOString() ?? null,
      };
    }),
    unreadCount: unread.data().count,
  };
}

/** Marks the given records (or all unread ones) as read. Only ever
 *  touches this doctor's own collection. */
export async function markDoctorNotificationsRead(
  doctorId: string,
  target: { ids: string[] } | { all: true }
): Promise<number> {
  const col = notificationsCol(doctorId);
  const docs =
    'all' in target
      ? (await col.where('read', '==', false).limit(500).get()).docs
      : (await adminDb.getAll(...target.ids.map((id) => col.doc(id)))).filter(
          (d) => d.exists && d.data()?.read !== true
        );
  if (docs.length === 0) return 0;
  const batch = adminDb.batch();
  docs.forEach((d) => batch.update(d.ref, { read: true }));
  await batch.commit();
  return docs.length;
}
