import { adminAuth, adminDb } from '@/lib/firebase-admin';

export interface AdminUserView {
  uid: string;
  email: string | null;
  fullName: string;
  dueDate: string | null;
  weeksPregnant: number | null;
  firstTimeMom: boolean | null;
  clinicName: string | null;
  createdAt: string | null;
  disabled: boolean;
}

/** Merges Firebase Auth records (email, disabled status) with each
 *  user's Firestore profile (fullName, dueDate, etc.) by UID.
 *  Deliberately does NOT touch health/mood/checklist data — this is a
 *  profile/account-management view only. */
export async function getUsers(): Promise<AdminUserView[]> {
  const profilesSnap = await adminDb.collection('users').get();
  const profiles = new Map<string, any>();
  profilesSnap.forEach((doc) => profiles.set(doc.id, doc.data()));

  const users: AdminUserView[] = [];
  let pageToken: string | undefined;

  do {
    const result = await adminAuth.listUsers(1000, pageToken);
    for (const authUser of result.users) {
      const profile = profiles.get(authUser.uid) ?? {};
      users.push({
        uid: authUser.uid,
        email: authUser.email ?? null,
        fullName: profile.fullName ?? '(no profile)',
        dueDate: profile.dueDate ?? null,
        weeksPregnant: profile.weeksPregnant ?? null,
        firstTimeMom: profile.firstTimeMom ?? null,
        clinicName: profile.clinicName ?? null,
        createdAt: profile.createdAt ?? authUser.metadata.creationTime ?? null,
        disabled: authUser.disabled,
      });
    }
    pageToken = result.pageToken;
  } while (pageToken);

  return users.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
}

export async function getUserById(uid: string): Promise<AdminUserView | null> {
  const users = await getUsers();
  return users.find((u) => u.uid === uid) ?? null;
}