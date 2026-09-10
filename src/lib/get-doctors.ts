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
  };
}

export async function getDoctors(): Promise<DoctorRecord[]> {
  const snapshot = await adminDb.collection('doctors').orderBy('name').get();
  return snapshot.docs.map((doc) => toDoctorRecord(doc.id, doc.data()));
}

export async function getDoctorById(id: string): Promise<DoctorRecord | null> {
  const doc = await adminDb.collection('doctors').doc(id).get();
  if (!doc.exists) return null;
  return toDoctorRecord(doc.id, doc.data()!);
}