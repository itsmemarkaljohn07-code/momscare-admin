import { adminDb } from '@/lib/firebase-admin';

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
  };
}

import { withRetry } from '@/lib/with-retry';

export async function getDoctors(): Promise<DoctorRecord[]> {
  const snapshot = await withRetry(() => adminDb.collection('doctors').orderBy('name').get());
  return snapshot.docs.map((doc) => toDoctorRecord(doc.id, doc.data()));
}

export async function getDoctorById(id: string): Promise<DoctorRecord | null> {
  const doc = await adminDb.collection('doctors').doc(id).get();
  if (!doc.exists) return null;
  return toDoctorRecord(doc.id, doc.data()!);
}