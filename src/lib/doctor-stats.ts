import { adminDb } from '@/lib/firebase-admin';
import { withRetry } from '@/lib/with-retry';
import { getAppointments, type AdminAppointment } from '@/lib/get-appointments';
import type { DoctorRecord } from '@/lib/get-doctors';

export interface DoctorStats {
  /** Patients who have this doctor in their assignedDoctorNames — the
   *  same definition the doctor's own "Assigned Patients" uses. */
  patients: number;
  /** Future appointments still marked upcoming. */
  upcomingAppointments: number;
  bookedThisWeek: number;
  weeklyCapacity: number;
  /** Booked ÷ capacity as a percentage; null when no schedule is set. */
  utilization: number | null;
  /** Upcoming appointments still waiting for this doctor's approval. */
  pendingApprovals: number;
}

export interface DoctorWorkloadData {
  appointments: AdminAppointment[];
  /** One entry per patient: the doctor names on their profile. */
  patientAssignments: string[][];
}

// Doctors are linked to appointments and patients by NAME, compared
// trimmed and case-insensitively — the same way the approval route
// decides whether an appointment belongs to a doctor.
const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

export async function getDoctorWorkloadData(): Promise<DoctorWorkloadData> {
  const [appointments, patientSnap] = await Promise.all([
    getAppointments(),
    // Only the one field is needed from each patient document.
    withRetry(() => adminDb.collection('users').select('assignedDoctorNames').get()),
  ]);

  const patientAssignments: string[][] = patientSnap.docs.map(
    (d) => (d.data().assignedDoctorNames as string[] | undefined) ?? []
  );

  return { appointments, patientAssignments };
}

// Identical to the calculation on the Overview page.
function weeklyCapacity(d: DoctorRecord): number {
  if (!d.startTime || !d.endTime || !d.slotMinutes || d.workingDays.length === 0) return 0;
  const [startH, startM] = d.startTime.split(':').map(Number);
  const [endH, endM] = d.endTime.split(':').map(Number);
  const totalMinutes = endH * 60 + endM - (startH * 60 + startM);
  if (totalMinutes <= 0) return 0;
  return Math.floor(totalMinutes / d.slotMinutes) * d.workingDays.length;
}

export function computeDoctorStats(
  doctors: DoctorRecord[],
  data: DoctorWorkloadData
): Record<string, DoctorStats> {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const weekFromNowStr = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const patientsByDoctor = new Map<string, number>();
  for (const names of data.patientAssignments) {
    // A patient counts once per doctor, however many times listed.
    for (const name of new Set(names.map(norm))) {
      if (name) patientsByDoctor.set(name, (patientsByDoctor.get(name) ?? 0) + 1);
    }
  }

  const upcoming = new Map<string, number>();
  const thisWeek = new Map<string, number>();
  const pending = new Map<string, number>();
  for (const a of data.appointments) {
    if (a.status !== 'upcoming' || a.date < todayStr) continue;
    const key = norm(a.doctor);
    upcoming.set(key, (upcoming.get(key) ?? 0) + 1);
    if (a.date <= weekFromNowStr) thisWeek.set(key, (thisWeek.get(key) ?? 0) + 1);
    if (a.doctorApproval === 'pending') pending.set(key, (pending.get(key) ?? 0) + 1);
  }

  const result: Record<string, DoctorStats> = {};
  for (const d of doctors) {
    const key = norm(d.name);
    const capacity = weeklyCapacity(d);
    const booked = thisWeek.get(key) ?? 0;
    result[d.id] = {
      patients: patientsByDoctor.get(key) ?? 0,
      upcomingAppointments: upcoming.get(key) ?? 0,
      bookedThisWeek: booked,
      weeklyCapacity: capacity,
      utilization: capacity > 0 ? Math.round((booked / capacity) * 100) : null,
      pendingApprovals: pending.get(key) ?? 0,
    };
  }
  return result;
}