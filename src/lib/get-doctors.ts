import { adminDb, adminAuth } from '@/lib/firebase-admin';

export interface DoctorRecord {
  id: string;
  name: string;
  specialty: string;
  workingDays: number[];
  startTime: string;
  endTime: string;
  slotMinutes: number;
  createdAt: string | null;
  authUid?: string | null;
  loginEmail?: string | null;
  username?: string | null;
  photoUrl?: string | null;
  title?: string | null;
  lastSignInTime?: string | null;
}

function toDoctorRecord(id: string, data: FirebaseFirestore.DocumentData): DoctorRecord {
  return {
    id,
    name: data.name,
    specialty: data.specialty,
    workingDays: data.workingDays ?? [],
    startTime: data.startTime,
    endTime: data.endTime,
    slotMinutes: data.slotMinutes,
    createdAt: data.createdAt?.toDate?.().toISOString() ?? null,
    authUid: data.authUid ?? null,
    loginEmail: data.loginEmail ?? null,
    username: data.username ?? null,
    photoUrl: data.photoUrl ?? null,
    title: data.title ?? null,
    lastSignInTime: null, // populated in getDoctors()/getDoctorById() below
  };
}

import { withRetry } from '@/lib/with-retry';

/** Batch-fetches lastSignInTime for every doctor that has a login set
 *  up (authUid present) in a single Auth call, and merges it onto the
 *  matching records in place. Doctors without a login (no authUid)
 *  simply keep lastSignInTime: null — there's nothing to look up. */
async function attachLastSignInTimes(doctors: DoctorRecord[]): Promise<DoctorRecord[]> {
  const withAuth = doctors.filter((d): d is DoctorRecord & { authUid: string } => !!d.authUid);
  if (withAuth.length === 0) return doctors;

  try {
    const { users } = await adminAuth.getUsers(withAuth.map((d) => ({ uid: d.authUid })));
    const byUid = new Map(users.map((u) => [u.uid, u.metadata.lastSignInTime ?? null]));
    return doctors.map((d) =>
      d.authUid && byUid.has(d.authUid) ? { ...d, lastSignInTime: byUid.get(d.authUid) ?? null } : d
    );
  } catch {
    // Non-critical — if the batch lookup fails for any reason, just
    // show the doctor list without last-active data rather than
    // failing the whole page.
    return doctors;
  }
}

export async function getDoctors(): Promise<DoctorRecord[]> {
  const snapshot = await withRetry(() => adminDb.collection('doctors').orderBy('name').get());
  const doctors = snapshot.docs.map((doc) => toDoctorRecord(doc.id, doc.data()));
  return attachLastSignInTimes(doctors);
}

export async function getDoctorById(id: string): Promise<DoctorRecord | null> {
  const doc = await adminDb.collection('doctors').doc(id).get();
  if (!doc.exists) return null;
  const [record] = await attachLastSignInTimes([toDoctorRecord(doc.id, doc.data()!)]);
  return record;
}