export type DisplayStatus = 'Upcoming' | 'Ongoing' | 'Completed' | 'Cancelled' | 'Missed';

/** Computes the appointment's real, current status live from its
 *  actual date/time vs. right now — never relies on a stored value
 *  going stale. An explicit action (Cancel, or marking it Complete)
 *  always takes priority over the time-based computation; otherwise
 *  the status follows the clock:
 *
 *  Upcoming before the start time, Ongoing until MISSED_AFTER_MS after
 *  it, then Missed. An appointment the patient attended is marked
 *  Completed by the clinic.
 *
 *  Note: the patient app has its own copy of this rule
 *  (MomsCare-app src/app/shared/appointment-status.ts), still set to 30
 *  minutes; it is not changed by this constant. */
export const MISSED_AFTER_MS = 3 * 60 * 60 * 1000; // 3 hours

/** Appointment times are entered and shown in Philippine time. Parsing
 *  them with this fixed offset gives the same moment on any server or
 *  browser, whatever its own time zone. (The Philippines has no DST.) */
const CLINIC_UTC_OFFSET = '+08:00';

/** "2026-09-15" + "9:30 AM" -> that moment, in Philippine time. */
export function parseApptDateTime(date: string, time12: string): Date | null {
  const match = time12.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [, hStr, mStr, suffix] = match;
  let hour = parseInt(hStr, 10);
  const minute = parseInt(mStr, 10);
  if (suffix.toUpperCase() === 'PM' && hour !== 12) hour += 12;
  if (suffix.toUpperCase() === 'AM' && hour === 12) hour = 0;
  const d = new Date(
    `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00${CLINIC_UTC_OFFSET}`
  );
  return isNaN(d.getTime()) ? null : d;
}

/** True when the appointment is Missed: stored as missed, or still
 *  upcoming at least MISSED_AFTER_MS after it started. Without a
 *  readable time, it is missed once its day (Philippine time) has passed. */
export function isMissedAppointment(
  a: { date: string; time: string; status: string },
  now: Date = new Date()
): boolean {
  if (a.status === 'missed') return true;
  if (a.status !== 'upcoming') return false;
  const start = parseApptDateTime(a.date, a.time ?? '');
  if (start) return now.getTime() >= start.getTime() + MISSED_AFTER_MS;
  const dayStart = parseApptDateTime(a.date, '12:00 AM');
  return !!dayStart && now.getTime() >= dayStart.getTime() + 24 * 60 * 60 * 1000;
}

/** How an appointment is named in a sentence: "Ultrasound" -> "Ultrasound
 *  appointment", while "Booking Appointment" stays as it is (no
 *  "Booking Appointment appointment"). */
export function appointmentName(label?: string | null): string {
  const name = (label ?? '').trim();
  if (!name) return 'appointment';
  return /appointment$/i.test(name) ? name : `${name} appointment`;
}

export function computeDisplayStatus(
  date: string,
  time: string,
  storedStatus: string
): DisplayStatus {
  if (storedStatus === 'cancelled') return 'Cancelled';
  // An admin/doctor explicitly marking it Completed always wins, even
  // if the scheduled time technically hasn't passed yet.
  if (storedStatus === 'completed') return 'Completed';

  const now = new Date();
  if (isMissedAppointment({ date, time, status: storedStatus }, now)) return 'Missed';

  const start = parseApptDateTime(date, time);
  if (!start || now < start) return 'Upcoming';
  return 'Ongoing';
}

/** Still waiting on the doctor. A cancelled appointment no longer needs
 *  a response, so it never counts as pending. */
export function isPendingDoctorApproval(a: { status: string; doctorApproval: string }): boolean {
  return a.doctorApproval === 'pending' && a.status !== 'cancelled';
}

export const DISPLAY_STATUS_VARIANT: Record<DisplayStatus, 'default' | 'secondary' | 'destructive'> = {
  Upcoming: 'default',
  Ongoing: 'default',
  Completed: 'secondary',
  Cancelled: 'destructive',
  Missed: 'destructive',
};
