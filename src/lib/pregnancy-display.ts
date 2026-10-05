import { computePregnancyWeek } from '@/lib/compute-pregnancy-week';

/**
 * The clinic's time zone. Every date on the doctor's patient and
 * snapshot pages is shown in this zone, so a due date or upload time
 * reads the same wherever the server happens to run and whoever is
 * looking. Change it here if the clinic ever moves.
 */
export const CLINIC_TIME_ZONE = 'Asia/Manila';

const DEFAULT_DATE: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };

/** Formats an ISO timestamp as a date in the clinic's time zone. */
export function formatClinicDate(
  iso: string | null | undefined,
  options: Intl.DateTimeFormatOptions = DEFAULT_DATE
): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { timeZone: CLINIC_TIME_ZONE, ...options });
}

/** Formats an ISO timestamp as date + time in the clinic's time zone. */
export function formatClinicDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    timeZone: CLINIC_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Formats a plain 'YYYY-MM-DD' key (like an appointment's date) without
 *  any time-zone shifting. */
export function formatDateKey(
  dateKey: string,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return dateKey;
  return d.toLocaleDateString('en-US', { timeZone: 'UTC', ...options });
}

/** Today's date as 'YYYY-MM-DD' in the clinic's time zone. */
export function todayInClinic(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: CLINIC_TIME_ZONE });
}

export type Trimester = 1 | 2 | 3;

export const TRIMESTER_LABELS: Record<Trimester, string> = {
  1: '1st trimester',
  2: '2nd trimester',
  3: '3rd trimester',
};

/** Completed weeks 0–13 = first trimester, 14–27 = second, 28+ = third. */
export function getTrimester(week: number | null): Trimester | null {
  if (week === null) return null;
  if (week < 14) return 1;
  if (week < 28) return 2;
  return 3;
}

export function getPregnancyInfo(dueDate: string | null): {
  week: number | null;
  trimester: Trimester | null;
  progress: number | null;
} {
  const week = computePregnancyWeek(dueDate);
  return {
    week,
    trimester: getTrimester(week),
    progress: week === null ? null : Math.min(100, Math.round((week / 40) * 100)),
  };
}