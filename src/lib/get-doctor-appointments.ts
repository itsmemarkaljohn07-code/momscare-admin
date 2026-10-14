import { adminDb } from '@/lib/firebase-admin';
import { withRetry } from '@/lib/with-retry';
import { mapCancellation, type AppointmentCancellation } from '@/lib/appointment-cancellation';

export interface DoctorAppointmentView {
  id: string;
  patientUid: string;
  patientName: string;
  label: string;
  type: string;
  date: string;
  time: string;
  location?: string;
  notes?: string;
  status: 'upcoming' | 'completed' | 'cancelled' | 'missed';
  doctorApproval: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  cancellation?: AppointmentCancellation;
}

export async function getDoctorAppointments(doctorName: string): Promise<DoctorAppointmentView[]> {
  // No .where() on the collectionGroup query — filtering happens in
  // plain JS below instead, matching the same pattern already used by
  // getDoctorPatients() and getAppointmentStats(). A filtered
  // collection-group query requires a special Firestore index to be
  // manually created; fetching everything and filtering here avoids
  // that requirement entirely.
    const [apptSnap, usersSnap] = await Promise.all([
    withRetry(() => adminDb.collectionGroup('appointments').get()),
    withRetry(() => adminDb.collection('users').get()),
  ]);

  const nameByUid = new Map(usersSnap.docs.map((d) => [d.id, d.data().fullName ?? '(unknown)']));

  return apptSnap.docs
    .filter((doc) => doc.data().doctor === doctorName)
    .map((doc) => {
      const data = doc.data();
      const patientUid = doc.ref.parent.parent?.id ?? '';
      return {
        id: doc.id,
        patientUid,
        patientName: nameByUid.get(patientUid) ?? '(unknown patient)',
        label: data.label,
        type: data.type,
        date: data.date,
        time: data.time,
        location: data.location,
        notes: data.notes,
        status: data.status,
        doctorApproval: data.doctorApproval ?? 'pending',
        rejectionReason: data.rejectionReason,
        cancellation: mapCancellation(data.cancellation),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}