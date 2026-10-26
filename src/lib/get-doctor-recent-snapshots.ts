import { adminDb } from '@/lib/firebase-admin';
import { withRetry } from '@/lib/with-retry';
import { patientName } from '@/lib/patient-name';

export interface DoctorRecentSnapshot {
  photoId: string;
  patientUid: string;
  patientName: string;
  imageUrl: string;
  type: string;
  week: number;
  createdAt: string | null;
}

export async function getDoctorRecentSnapshots(
  doctorName: string,
  max = 6
): Promise<DoctorRecentSnapshot[]> {
  const usersSnap = await withRetry(() =>
    adminDb
      .collection('users')
      .where('assignedDoctorNames', 'array-contains', doctorName)
      .get()
  );

  if (usersSnap.empty) return [];

  const nameByUid = new Map(usersSnap.docs.map((d) => [d.id, patientName(d.data(), '(unnamed patient)')]));
  const patientUids = new Set(usersSnap.docs.map((d) => d.id));

    const snapshotsSnap = await withRetry(() => adminDb.collectionGroup('snapshots').get());

  const results: DoctorRecentSnapshot[] = [];
  for (const doc of snapshotsSnap.docs) {
    const uid = doc.ref.parent.parent?.id;
    if (!uid || !patientUids.has(uid)) continue;
    const data = doc.data();
    results.push({
      photoId: doc.id,
      patientUid: uid,
      patientName: nameByUid.get(uid) ?? '(unknown patient)',
      imageUrl: data.imageUrl,
      type: data.type,
      week: data.week,
      createdAt: data.createdAt?.toDate?.().toISOString() ?? null,
    });
  }

  return results
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
    .slice(0, max);
}