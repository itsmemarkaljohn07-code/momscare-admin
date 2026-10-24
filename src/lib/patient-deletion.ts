import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { logMinimalAuditEvent } from '@/lib/audit-log';
import { deleteCloudinaryImages, isCloudinaryDeleteConfigured } from '@/lib/cloudinary-admin';
import type { UserRecord } from 'firebase-admin/auth';

export type StepStatus = 'done' | 'already_gone' | 'skipped' | 'failed';

export type StepName =
  | 'disable_login'
  | 'read_data'
  | 'cloudinary_images'
  | 'firestore_data'
  | 'username'
  | 'audit_history'
  | 'login_account'
  | 'audit_entry';

export interface StepResult {
  step: StepName;
  status: StepStatus;
  detail?: string;
}

export interface DeletionResult {
  ok: boolean;
  steps: StepResult[];
  /** Present when images were not deleted automatically (Cloudinary
   *  credentials missing, or the Cloudinary step failed) so an admin can
   *  remove them by hand in the Media Library. */
  manualCloudinaryPublicIds?: string[];
}

export interface PatientIdentity {
  profileExists: boolean;
  authExists: boolean;
  fullName: string | null;
  /** Lower-cased usernames that may belong to this patient: the profile
   *  field plus every usernames/{name} doc whose uid matches. */
  usernames: string[];
  /** Lower-cased emails from the Auth record and usernames docs. */
  emails: string[];
  /** What the admin must type. Username when the patient has one,
   *  otherwise email; null when nothing identifying is left. */
  confirmBy: 'username' | 'email' | null;
  confirmValue: string | null;
}

export interface DeletionPreview extends PatientIdentity {
  collections: { name: string; count: number }[];
  comments: number;
  photos: number;
  auditEntries: number;
  cloudinaryConfigured: boolean;
}

const DELETED_LABEL = 'Deleted patient';

function isAuthNotFound(err: unknown): boolean {
  return (err as { code?: string })?.code === 'auth/user-not-found';
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Unknown error';
}

/** True when the uid belongs to an admin or a doctor login — the same
 *  three sources getUsers() uses to exclude non-patients. */
export async function isNonPatientUid(uid: string): Promise<boolean> {
  const [adminDoc, doctorAccountDoc, doctorsSnap] = await Promise.all([
    adminDb.collection('admins').doc(uid).get(),
    adminDb.collection('doctorAccounts').doc(uid).get(),
    adminDb.collection('doctors').where('authUid', '==', uid).limit(1).get(),
  ]);
  return adminDoc.exists || doctorAccountDoc.exists || !doctorsSnap.empty;
}

export async function getPatientIdentity(uid: string): Promise<PatientIdentity> {
  const [profileDoc, usernamesSnap, authUser] = await Promise.all([
    adminDb.collection('users').doc(uid).get(),
    adminDb.collection('usernames').where('uid', '==', uid).get(),
    adminAuth.getUser(uid).catch((err): UserRecord | null => {
      if (isAuthNotFound(err)) return null;
      throw err;
    }),
  ]);

  const profile = profileDoc.data();
  const usernames = new Set<string>();
  const profileUsername = typeof profile?.username === 'string' ? profile.username.trim() : '';
  if (profileUsername) usernames.add(profileUsername.toLowerCase());
  usernamesSnap.docs.forEach((d) => usernames.add(d.id.toLowerCase()));

  const emails = new Set<string>();
  if (authUser?.email) emails.add(authUser.email.trim().toLowerCase());
  usernamesSnap.docs.forEach((d) => {
    const email = d.data().email;
    if (typeof email === 'string' && email.trim()) emails.add(email.trim().toLowerCase());
  });

  let confirmBy: PatientIdentity['confirmBy'] = null;
  let confirmValue: string | null = null;
  if (usernames.size > 0) {
    confirmBy = 'username';
    confirmValue = profileUsername || usernamesSnap.docs[0].id;
  } else if (emails.size > 0) {
    confirmBy = 'email';
    confirmValue = authUser?.email ?? [...emails][0];
  }

  return {
    profileExists: profileDoc.exists,
    authExists: authUser !== null,
    fullName: typeof profile?.fullName === 'string' ? profile.fullName : null,
    usernames: [...usernames],
    emails: [...emails],
    confirmBy,
    confirmValue,
  };
}

/** Case-insensitive check of what the admin typed against the
 *  identifier the patient is confirmed by. */
export function confirmationMatches(identity: PatientIdentity, typed: unknown): boolean {
  if (typeof typed !== 'string') return false;
  const value = typed.trim().toLowerCase();
  if (!value) return false;
  if (identity.confirmBy === 'username') return identity.usernames.includes(value);
  if (identity.confirmBy === 'email') return identity.emails.includes(value);
  return false;
}

export async function getDeletionPreview(uid: string): Promise<DeletionPreview> {
  const identity = await getPatientIdentity(uid);
  const userRef = adminDb.collection('users').doc(uid);

  const [subcollections, snapshotsSnap, auditCount] = await Promise.all([
    userRef.listCollections(),
    userRef.collection('snapshots').get(),
    adminDb.collection('auditLogs').where('targetId', '==', uid).count().get(),
  ]);

  const collections = await Promise.all(
    subcollections.map(async (col) => ({
      name: col.id,
      count: (await col.count().get()).data().count,
    }))
  );

  const commentCounts = await Promise.all(
    snapshotsSnap.docs.map(async (d) => (await d.ref.collection('comments').count().get()).data().count)
  );

  return {
    ...identity,
    collections: collections.sort((a, b) => a.name.localeCompare(b.name)),
    comments: commentCounts.reduce((sum, n) => sum + n, 0),
    photos: snapshotsSnap.docs.filter((d) => !!d.data().cloudinaryPublicId).length,
    auditEntries: auditCount.data().count,
    cloudinaryConfigured: isCloudinaryDeleteConfigured(),
  };
}

/**
 * Deletes everything belonging to a patient. Each step is idempotent, so
 * a retry after a partial failure finishes the rest and reports parts
 * that are already gone as 'already_gone' instead of erroring. The first
 * failed step halts the run — later steps are reported as 'skipped' —
 * so, for example, Firestore is never deleted while the Cloudinary IDs
 * it holds are still needed. The Auth account is removed last because
 * it carries the email a retry may need for confirmation.
 *
 * Callers must already have checked the admin session, the patient-only
 * guard and the typed confirmation.
 */
export async function deletePatient(uid: string, actorUid: string): Promise<DeletionResult> {
  const steps: StepResult[] = [];
  let halted = false;
  let manualCloudinaryPublicIds: string[] | undefined;

  async function run(step: StepName, fn: () => Promise<Omit<StepResult, 'step'>>) {
    if (halted) {
      steps.push({ step, status: 'skipped', detail: 'Not attempted because an earlier step failed.' });
      return;
    }
    try {
      steps.push({ step, ...(await fn()) });
    } catch (err) {
      console.error(`[patient-deletion] step ${step} failed:`, errorMessage(err));
      steps.push({ step, status: 'failed', detail: errorMessage(err) });
      halted = true;
    }
  }

  const userRef = adminDb.collection('users').doc(uid);
  let publicIds: string[] = [];
  let usernameCandidates: string[] = [];

  // 1. Stop new sign-ins and invalidate refresh tokens so nothing new
  //    (e.g. a snapshot upload) lands while deletion is in progress.
  await run('disable_login', async () => {
    try {
      await adminAuth.updateUser(uid, { disabled: true });
      await adminAuth.revokeRefreshTokens(uid);
      return { status: 'done' };
    } catch (err) {
      if (isAuthNotFound(err)) return { status: 'already_gone' };
      throw err;
    }
  });

  // 2. Read what later steps need before anything is deleted.
  await run('read_data', async () => {
    const [profileDoc, snapshotsSnap, usernamesSnap] = await Promise.all([
      userRef.get(),
      userRef.collection('snapshots').get(),
      adminDb.collection('usernames').where('uid', '==', uid).get(),
    ]);
    publicIds = snapshotsSnap.docs
      .map((d) => d.data().cloudinaryPublicId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
    const names = new Set<string>(usernamesSnap.docs.map((d) => d.id));
    const profileUsername = profileDoc.data()?.username;
    if (typeof profileUsername === 'string' && profileUsername.trim()) {
      names.add(profileUsername.trim().toLowerCase());
    }
    usernameCandidates = [...names];
    return { status: 'done', detail: `${publicIds.length} photo(s) found.` };
  });

  // 3. Cloudinary images, before Firestore loses their public IDs.
  await run('cloudinary_images', async () => {
    if (publicIds.length === 0) return { status: 'already_gone', detail: 'No photos to delete.' };
    if (!isCloudinaryDeleteConfigured()) {
      manualCloudinaryPublicIds = publicIds;
      return {
        status: 'skipped',
        detail: `Cloudinary credentials are not configured on the server. ${publicIds.length} image(s) must be deleted manually in the Media Library.`,
      };
    }
    try {
      await deleteCloudinaryImages(publicIds);
    } catch (err) {
      manualCloudinaryPublicIds = publicIds;
      throw err;
    }
    return { status: 'done', detail: `${publicIds.length} image(s) deleted and purged from the CDN.` };
  });

  // 4. users/{uid} and every subcollection under it, including
  //    snapshots/*/comments, clinicalNotes and stays (birth stays).
  await run('firestore_data', async () => {
    const [profileDoc, subcollections] = await Promise.all([userRef.get(), userRef.listCollections()]);
    if (!profileDoc.exists && subcollections.length === 0) return { status: 'already_gone' };
    await adminDb.recursiveDelete(userRef);
    return { status: 'done' };
  });

  // 5. usernames/{name} — only docs that really point at this uid, so a
  //    stale profile field can never release someone else's username.
  await run('username', async () => {
    let deleted = 0;
    for (const name of usernameCandidates) {
      const ref = adminDb.collection('usernames').doc(name);
      const doc = await ref.get();
      if (doc.exists && doc.data()?.uid === uid) {
        await ref.delete();
        deleted++;
      }
    }
    return deleted > 0 ? { status: 'done' } : { status: 'already_gone' };
  });

  // 6. Strip the patient's name from existing audit entries about them.
  //    Action, actor and createdAt are kept.
  await run('audit_history', async () => {
    const snap = await adminDb.collection('auditLogs').where('targetId', '==', uid).get();
    const toUpdate = snap.docs.filter(
      (d) => d.data().targetLabel !== DELETED_LABEL || (d.data().details ?? null) !== null
    );
    if (toUpdate.length === 0) return { status: 'already_gone', detail: `All ${snap.size} audit entries already anonymised.` };
    for (let i = 0; i < toUpdate.length; i += 500) {
      const batch = adminDb.batch();
      toUpdate.slice(i, i + 500).forEach((d) => batch.update(d.ref, { targetLabel: DELETED_LABEL, details: null }));
      await batch.commit();
    }
    return { status: 'done', detail: `${toUpdate.length} audit entries anonymised.` };
  });

  // 7. The Auth account itself.
  await run('login_account', async () => {
    try {
      await adminAuth.deleteUser(uid);
      return { status: 'done' };
    } catch (err) {
      if (isAuthNotFound(err)) return { status: 'already_gone' };
      throw err;
    }
  });

  const ok = !steps.some((s) => s.status === 'failed');
  const didWork = steps.some(
    (s) => s.status === 'done' && s.step !== 'disable_login' && s.step !== 'read_data'
  );

  // 8. Audit entry with no personal data: action, date and the acting
  //    admin's uid only. Written whenever this run deleted something,
  //    so a partial run is recorded too.
  if (didWork) {
    const logged = await logMinimalAuditEvent({
      actorUid,
      actorRole: 'admin',
      action: ok ? 'user.delete' : 'user.delete_incomplete',
    });
    steps.push(
      logged
        ? { step: 'audit_entry', status: 'done' }
        : { step: 'audit_entry', status: 'failed', detail: 'Could not record the audit entry.' }
    );
  } else {
    steps.push({ step: 'audit_entry', status: 'skipped', detail: 'Nothing was deleted in this run.' });
  }

  return { ok: !steps.some((s) => s.status === 'failed'), steps, manualCloudinaryPublicIds };
}
