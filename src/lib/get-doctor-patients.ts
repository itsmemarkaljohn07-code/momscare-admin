import { adminDb } from '@/lib/firebase-admin';
import { withRetry } from '@/lib/with-retry';

export interface DoctorPatientSummary {
  uid: string;
  fullName: string;
  email: string | null;
  dueDate: string | null;
  photoCount: number;
  lastUploadAt: string | null;
}

export async function getDoctorPatients(doctorName: string): Promise<DoctorPatientSummary[]> {
    const usersSnap = await withRetry(() =>
    adminDb
      .collection('users')
      .where('assignedDoctorNames', 'array-contains', doctorName)
      .get()
  );

  if (usersSnap.empty) return [];

  const patientUids = new Set(usersSnap.docs.map((d) => d.id));
  const patients = new Map<string, DoctorPatientSummary>();
  for (const doc of usersSnap.docs) {
    const data = doc.data();
    patients.set(doc.id, {
      uid: doc.id,
      fullName: data.fullName ?? '(unnamed patient)',
      email: data.email ?? null,
      dueDate: data.dueDate ?? null,
      photoCount: 0,
      lastUploadAt: null,
    });
  }

  const snapshotsSnap = await adminDb.collectionGroup('snapshots').get();
  for (const doc of snapshotsSnap.docs) {
    const uid = doc.ref.parent.parent?.id;
    if (!uid || !patientUids.has(uid)) continue;
    const p = patients.get(uid)!;
    const createdAt: string | null = doc.data().createdAt?.toDate?.().toISOString() ?? null;
    p.photoCount += 1;
    if (createdAt && (!p.lastUploadAt || createdAt > p.lastUploadAt)) {
      p.lastUploadAt = createdAt;
    }
  }

  return Array.from(patients.values()).sort((a, b) =>
    (b.lastUploadAt ?? '').localeCompare(a.lastUploadAt ?? '')
  );
}