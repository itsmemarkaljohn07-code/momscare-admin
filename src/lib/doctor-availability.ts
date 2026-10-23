// Pure rules for a doctor's free appointment slots. No Firebase imports, so
// it can be unit-tested with plain Node and shared by the server routes.
//
// Times are clinic (Philippine, UTC+8, no DST) wall-clock times.

export interface DoctorSchedule {
  workingDays?: number[] | null;
  /** "HH:mm" */
  startTime?: string | null;
  endTime?: string | null;
  slotMinutes?: number | null;
}

/** One of this doctor's appointments (any status). */
export interface BookedAppointment {
  /** yyyy-MM-dd */
  date: string;
  /** "9:30 AM" (as stored) or "09:30" */
  time: string;
  status: string;
  /** A declined appointment no longer takes its slot. */
  doctorApproval?: string;
}

/** A patient's preferred window: yyyy-MM-dd + "HH:mm" from/to. */
export interface PreferredWindow {
  date: string;
  from: string;
  to: string;
}

export type NoSlotReason = 'no_schedule' | 'not_working_day' | 'fully_booked' | 'no_overlap';

export interface AvailabilityResult {
  /** Free slot start times, "HH:mm", ascending. */
  slots: string[];
  /** Why the list is empty; null when it isn't. */
  reason: NoSlotReason | null;
}

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const HHMM_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const CLINIC_OFFSET_MS = 8 * 60 * 60 * 1000;

/** "HH:mm" -> minutes after midnight, or null. */
function hhmmToMinutes(s: string | null | undefined): number | null {
  const m = typeof s === 'string' ? s.match(HHMM_PATTERN) : null;
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** "9:30 AM" / "09:30" -> minutes after midnight, or null. */
export function timeToMinutes(time: string): number | null {
  const twelve = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (twelve) {
    let h = Number(twelve[1]);
    const m = Number(twelve[2]);
    if (h < 1 || h > 12 || m > 59) return null;
    const pm = twelve[3].toUpperCase() === 'PM';
    if (pm && h !== 12) h += 12;
    if (!pm && h === 12) h = 0;
    return h * 60 + m;
  }
  return hhmmToMinutes(time.trim());
}

export function minutesToHHmm(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** "09:30" -> "9:30 AM" (how appointments store their time). */
export function hhmmTo12h(hhmm: string): string {
  const total = hhmmToMinutes(hhmm);
  if (total === null) return hhmm;
  const h = Math.floor(total / 60);
  return `${h % 12 || 12}:${String(total % 60).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

/** Day of the week (0 = Sunday) of a calendar date, independent of time zone. */
export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** The clinic's current date and minutes after midnight. */
export function clinicNow(now: Date): { date: string; minutes: number } {
  const local = new Date(now.getTime() + CLINIC_OFFSET_MS);
  return { date: local.toISOString().slice(0, 10), minutes: local.getUTCHours() * 60 + local.getUTCMinutes() };
}

/** Lock document id for one doctor's slot: {doctorId}_{date}_{HH-mm}. */
export function slotLockId(doctorId: string, date: string, hhmm: string): string {
  return `${doctorId}_${date}_${hhmm.replace(':', '-')}`;
}

/** Every slot start of the doctor's day, or null when the schedule is incomplete. */
export function daySlots(schedule: DoctorSchedule): number[] | null {
  const start = hhmmToMinutes(schedule.startTime);
  const end = hhmmToMinutes(schedule.endTime);
  const step = Number(schedule.slotMinutes);
  if (
    start === null || end === null || start >= end ||
    !Number.isFinite(step) || step < 5 ||
    !Array.isArray(schedule.workingDays) || schedule.workingDays.length === 0
  ) {
    return null;
  }
  const out: number[] = [];
  for (let t = start; t + step <= end; t += step) out.push(t);
  return out;
}

/**
 * The doctor's free slots on `date`: the schedule's slots on a working
 * day, minus any slot overlapping one of the doctor's 'upcoming'
 * appointments that day (cancelled, completed and missed ones release it),
 * minus times already past, then — when `windows` is given — only slots
 * that start inside one of the patient's windows for that date.
 *
 * `appointments` must already be this doctor's.
 */
export function availableSlots(input: {
  schedule: DoctorSchedule;
  date: string;
  appointments: BookedAppointment[];
  windows?: PreferredWindow[] | null;
  now?: Date;
}): AvailabilityResult {
  const { schedule, date, appointments, windows } = input;
  const all = daySlots(schedule);
  if (!all || !DAY_PATTERN.test(date)) return { slots: [], reason: 'no_schedule' };
  if (!schedule.workingDays!.includes(weekdayOf(date))) return { slots: [], reason: 'not_working_day' };

  const step = Number(schedule.slotMinutes);
  const busy: [number, number][] = [];
  for (const a of appointments) {
    if (a.status !== 'upcoming' || a.doctorApproval === 'rejected' || a.date !== date) continue;
    const start = timeToMinutes(a.time);
    if (start !== null) busy.push([start, start + step]);
  }

  const now = clinicNow(input.now ?? new Date());
  const free = all.filter((t) => {
    if (date < now.date || (date === now.date && t <= now.minutes)) return false;
    return !busy.some(([s, e]) => t < e && s < t + step);
  });
  if (free.length === 0) return { slots: [], reason: 'fully_booked' };

  if (windows) {
    const sameDay = windows
      .filter((w) => w.date === date)
      .map((w) => [hhmmToMinutes(w.from), hhmmToMinutes(w.to)] as const)
      .filter((w): w is readonly [number, number] => w[0] !== null && w[1] !== null);
    const inside = free.filter((t) => sameDay.some(([from, to]) => t >= from && t < to));
    if (inside.length === 0) return { slots: [], reason: 'no_overlap' };
    return { slots: inside.map(minutesToHHmm), reason: null };
  }

  return { slots: free.map(minutesToHHmm), reason: null };
}
