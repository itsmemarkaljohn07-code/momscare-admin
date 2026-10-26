import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { withRetry } from '@/lib/with-retry';
import { dobKey } from '@/lib/date-of-birth';
import { patientName, patientNameParts } from '@/lib/patient-name';

export interface AdminUserView {
  uid: string;
  email: string | null;
  /** "First Middle Last" (from the name parts, else the stored fullName). */
  fullName: string;
  /** Name parts; for older accounts split from fullName (first word / the rest). */
  firstName: string;
  middleName: string;
  lastName: string;
  username: string | null;
  dueDate: string | null;
  /** Date of birth as a Philippine date, "YYYY-MM-DD" (null when not recorded). */
  dob: string | null;
  weeksPregnant: number | null;
  firstTimeMom: boolean | null;
  clinicName: string | null;
  createdAt: string | null;
  disabled: boolean;
  lastSignInTime: string | null;
  assignedDoctorNames: string[];
}

/** Merges Firebase Auth records (email, disabled status) with each
 *  user's Firestore profile (fullName, dueDate, etc.) by UID.
 *
 *  IMPORTANT: Firebase Auth is one shared pool across every role —
 *  patients, doctors, and admins all show up in listUsers(). Doctor
 *  and admin accounts are tracked separately (doctorAccounts/{uid},
 *  admins/{uid}) precisely so this function can exclude them and
 *  return patients only. Without this, every doctor/admin account
 *  leaked into the patient list as a junk "(no profile)" row.
 *
 *  Deliberately does NOT touch health/mood/checklist data — this is a
 *  profile/account-management view only. */
export async function getUsers(): Promise<AdminUserView[]> {
  const [profilesSnap, doctorAccountsSnap, doctorsSnap, adminsSnap] = await Promise.all([
    withRetry(() => adminDb.collection('users').get()),
    withRetry(() => adminDb.collection('doctorAccounts').get()),
    withRetry(() => adminDb.collection('doctors').get()),
    withRetry(() => adminDb.collection('admins').get()),
  ]);

  const profiles = new Map<string, FirebaseFirestore.DocumentData>();
  profilesSnap.forEach((doc) => profiles.set(doc.id, doc.data()));

  // Doctor accounts created via "Add Doctor Account" write a
  // doctorAccounts/{uid} doc; doctors who instead got a login added
  // later via "Set Up Login" may only have authUid set directly on
  // their doctors/{id} doc. Checking both sources means a doctor is
  // excluded regardless of which flow gave them a login.
  const nonPatientUids = new Set<string>();
  doctorAccountsSnap.forEach((doc) => nonPatientUids.add(doc.id));
  doctorsSnap.forEach((doc) => {
    const authUid = doc.data().authUid;
    if (authUid) nonPatientUids.add(authUid);
  });
  adminsSnap.forEach((doc) => nonPatientUids.add(doc.id));

  const users: AdminUserView[] = [];
  let pageToken: string | undefined;

  do {
    const result = await adminAuth.listUsers(1000, pageToken);
    for (const authUser of result.users) {
      if (nonPatientUids.has(authUser.uid)) continue;

      const profile = profiles.get(authUser.uid) ?? {};
      users.push({
        uid: authUser.uid,
        email: authUser.email ?? null,
        fullName: patientName(profile, '(no profile)'),
        firstName: patientNameParts(profile).first,
        middleName: patientNameParts(profile).middle,
        lastName: patientNameParts(profile).last,
        username: profile.username || null,
        dueDate: profile.dueDate ?? null,
        dob: dobKey(profile.dob),
        weeksPregnant: profile.weeksPregnant ?? null,
        firstTimeMom: profile.firstTimeMom ?? null,
        clinicName: profile.clinicName ?? null,
        createdAt: profile.createdAt ?? authUser.metadata.creationTime ?? null,
        disabled: authUser.disabled,
        lastSignInTime: authUser.metadata.lastSignInTime ?? null,
        assignedDoctorNames: profile.assignedDoctorNames ?? [],
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