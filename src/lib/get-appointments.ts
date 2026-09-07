import { adminDb } from '@/lib/firebase-admin';
import { getUsers } from '@/lib/get-users';

export interface AdminAppointment {
  id: string;
  patientUid: string;
  patientName: string;
  label: string;
  type: string;
  doctor: string;
  date: string;
  time: string;
  location?: string;
  notes?: string;
  icon: string;
  accentColor: 'green' | 'pink' | 'purple' | 'blue' | 'orange';
  status: 'upcoming' | 'completed' | 'cancelled';
  createdAt?: string | null;
}

/** Uses a Firestore collection-group query to read appointments across
 *  EVERY patient's subcollection at once — this is what lets the admin
 *  see the whole clinic's schedule, not just one patient at a time. */
export async function getAppointments(): Promise<AdminAppointment[]> {
  const [snapshot, users] = await Promise.all([
    adminDb.collectionGroup('appointments').get(),
    getUsers(),
  ]);

  const nameByUid = new Map(users.map((u) => [u.uid, u.fullName]));

  const appointments: AdminAppointment[] = snapshot.docs.map((doc) => {
    const data = doc.data();
    const patientUid = doc.ref.parent.parent?.id ?? data.userId ?? 'unknown';
    return {
      id: doc.id,
      patientUid,
      patientName: nameByUid.get(patientUid) ?? '(unknown patient)',
      label: data.label,
      type: data.type,
      doctor: data.doctor,
      date: data.date,
      time: data.time,
      location: data.location ?? '',
      notes: data.notes ?? '',
      icon: data.icon,
      accentColor: data.accentColor,
      status: data.status,
      createdAt: data.createdAt?.toDate?.().toISOString() ?? null,
    };
  });

  return appointments.sort((a, b) => a.date.localeCompare(b.date));
}