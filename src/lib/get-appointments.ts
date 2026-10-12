import { adminDb } from '@/lib/firebase-admin';
import { getUsers } from '@/lib/get-users';
import { mapCancellation, type AppointmentCancellation } from '@/lib/appointment-cancellation';

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
  doctorApproval: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  createdAt?: string | null;
  cancellation?: AppointmentCancellation;
}

/** Uses a Firestore collection-group query to read appointments across
 *  EVERY patient's subcollection at once — this is what lets the admin
 *  see the whole clinic's schedule, not just one patient at a time. */
import { withRetry } from '@/lib/with-retry';

export async function getAppointments(): Promise<AdminAppointment[]> {
  const [snapshot, users] = await Promise.all([
    withRetry(() => adminDb.collectionGroup('appointments').get()),
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
      doctorApproval: data.doctorApproval ?? 'pending',
      rejectionReason: data.rejectionReason,
      createdAt: data.createdAt?.toDate?.().toISOString() ?? null,
      cancellation: mapCancellation(data.cancellation),
    };
  });

  return appointments.sort((a, b) => a.date.localeCompare(b.date));
}

const PENDING_COUNT_TTL_MS = 60_000;

// Per server instance. Keeps the admin layout from re-reading every
// appointment on each render; a failed read is not cached.
let pendingCountCache: { value: number; at: number } | null = null;

/** Call after a cancellation decision is saved. */
export function clearPendingCancellationCountCache(): void {
  pendingCountCache = null;
}

/** Open cancellation requests, for the admin sidebar badge. Reads only
 *  the two fields it needs and filters in JS (a filtered collection-group
 *  query would need its own index), cached for 60 seconds. Never throws:
 *  a failed count must not break every admin page. */
export async function getPendingCancellationCount(): Promise<number> {
  if (pendingCountCache && Date.now() - pendingCountCache.at < PENDING_COUNT_TTL_MS) {
    return pendingCountCache.value;
  }
  try {
    const snapshot = await withRetry(() =>
      adminDb.collectionGroup('appointments').select('status', 'cancellation').get()
    );
    const value = snapshot.docs.filter((doc) => {
      const data = doc.data();
      return data.status === 'upcoming' && data.cancellation?.state === 'requested';
    }).length;
    pendingCountCache = { value, at: Date.now() };
    return value;
  } catch (err) {
    console.error('Failed to count cancellation requests (non-fatal):', err);
    return 0;
  }
}