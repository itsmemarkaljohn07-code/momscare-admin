// Pure rules for the doctor's "new appointment to review" bell entry. No
// Firebase imports, so it can be unit-tested with plain Node.

export interface DoctorRef {
  id: string;
  name: string;
}

export const APPOINTMENT_NOTICE_TITLE = 'New appointment to review';
export const APPOINTMENT_NOTICE_LINK = '/doctor/appointments';

/** Deterministic id: one entry per appointment, however often it runs. */
export function appointmentNoticeId(appointmentId: string): string {
  return `appointment-${appointmentId}`;
}

/** Patient name, date and time only: no notes, type or health data. */
export function appointmentNoticeMessage(patientName: string, date: string, time: string): string {
  return `${patientName}: ${date} at ${time}. Open My Appointments to approve or decline.`;
}

/**
 * The doctor on a new appointment: by id when the request has one,
 * otherwise by exact name. Returns null unless exactly one doctor matches,
 * so an ambiguous or unknown doctor is never notified.
 */
export function resolveAppointmentDoctor(
  doctors: DoctorRef[],
  request: { doctorId?: string | null; doctorName?: string | null }
): DoctorRef | null {
  const id = request.doctorId?.trim();
  if (id) {
    const byId = doctors.filter((d) => d.id === id);
    return byId.length === 1 ? byId[0] : null;
  }
  const name = request.doctorName?.trim();
  if (!name) return null;
  const byName = doctors.filter((d) => d.name.trim() === name);
  return byName.length === 1 ? byName[0] : null;
}
