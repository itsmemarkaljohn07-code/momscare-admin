export type DisplayStatus = 'Upcoming' | 'Ongoing' | 'Completed' | 'Cancelled';

/** Computes the appointment's real, current status live from its
 *  actual date/time vs. right now — never relies on a stored value
 *  going stale. An explicit admin action (Cancel, or manually marking
 *  Complete) always takes priority over the time-based computation;
 *  otherwise, status is derived purely from whether the scheduled
 *  time is in the future, currently happening, or has passed.
 *
 *  "Ongoing" uses a 60-minute window from the scheduled start time —
 *  a reasonable default since appointment duration isn't stored on
 *  the appointment itself (only on the doctor's own schedule
 *  settings). Adjust ONGOING_WINDOW_MINUTES if you'd like this tied
 *  to each doctor's actual slot length instead. */
const ONGOING_WINDOW_MINUTES = 60;

function parseApptDateTime(date: string, time12: string): Date | null {
  const match = time12.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return null;
  const [, hStr, mStr, suffix] = match;
  let hour = parseInt(hStr, 10);
  const minute = parseInt(mStr, 10);
  if (suffix.toUpperCase() === 'PM' && hour !== 12) hour += 12;
  if (suffix.toUpperCase() === 'AM' && hour === 12) hour = 0;
  const d = new Date(date + 'T00:00:00');
  d.setHours(hour, minute, 0, 0);
  return d;
}

export function computeDisplayStatus(
  date: string,
  time: string,
  storedStatus: string
): DisplayStatus {
  if (storedStatus === 'cancelled') return 'Cancelled';

  const start = parseApptDateTime(date, time);
  if (!start) return storedStatus === 'completed' ? 'Completed' : 'Upcoming';

  // An admin/doctor explicitly marking it Completed always wins, even
  // if the scheduled time technically hasn't passed yet.
  if (storedStatus === 'completed') return 'Completed';

  const now = new Date();
  const end = new Date(start.getTime() + ONGOING_WINDOW_MINUTES * 60 * 1000);

  if (now < start) return 'Upcoming';
  if (now >= start && now < end) return 'Ongoing';
  return 'Completed';
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
};