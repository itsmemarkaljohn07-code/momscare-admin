import { adminDb } from '@/lib/firebase-admin';
import {
  availableSlots,
  type AvailabilityResult,
  type BookedAppointment,
  type DoctorSchedule,
  type PreferredWindow,
} from '@/lib/doctor-availability';

export interface DoctorForSlots {
  id: string;
  name: string;
  schedule: DoctorSchedule;
}

export async function getDoctorForSlots(doctorId: string): Promise<DoctorForSlots | null> {
  const snap = await adminDb.collection('doctors').doc(doctorId).get();
  if (!snap.exists) return null;
  const d = snap.data() ?? {};
  return {
    id: snap.id,
    name: String(d.name ?? ''),
    schedule: { workingDays: d.workingDays, startTime: d.startTime, endTime: d.endTime, slotMinutes: d.slotMinutes },
  };
}

/** The doctor whose stored name is exactly `name`, or null when none or
 *  several match (appointments store the doctor by name). */
export async function getDoctorForSlotsByName(name: string): Promise<DoctorForSlots | null> {
  const wanted = name.trim();
  if (!wanted) return null;
  const snap = await adminDb.collection('doctors').select('name').get();
  const matches = snap.docs.filter((d) => String(d.get('name') ?? '').trim() === wanted);
  return matches.length === 1 ? getDoctorForSlots(matches[0].id) : null;
}

/**
 * This doctor's appointments on `date`, any status. One plain
 * collection-group read of four fields, filtered here (a filtered
 * collection-group query would need an index).
 */
export async function getDoctorAppointmentsOn(
  doctorName: string,
  date: string,
  exclude?: { patientUid: string; id: string }
): Promise<BookedAppointment[]> {
  const snap = await adminDb.collectionGroup('appointments').select('doctor', 'date', 'time', 'status').get();
  const wanted = doctorName.trim().toLowerCase();
  return snap.docs
    .filter((d) => !(exclude && d.id === exclude.id && d.ref.parent.parent?.id === exclude.patientUid))
    .filter((d) => String(d.get('doctor') ?? '').trim().toLowerCase() === wanted && d.get('date') === date)
    .map((d) => ({ date, time: String(d.get('time') ?? ''), status: String(d.get('status') ?? '') }));
}

/** Free slots for a doctor on a date, optionally limited to a patient's
 *  preferred windows. */
export async function getAvailableSlots(
  doctor: DoctorForSlots,
  date: string,
  windows?: PreferredWindow[] | null,
  exclude?: { patientUid: string; id: string }
): Promise<AvailabilityResult> {
  const appointments = await getDoctorAppointmentsOn(doctor.name, date, exclude);
  return availableSlots({ schedule: doctor.schedule, date, appointments, windows });
}
