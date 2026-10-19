/** Current pregnancy week from a due date, using the standard 280-day
 *  (40-week) gestation model. Returns null if no due date is set. `now`
 *  (ms) defaults to the current time; reports and tests pass their own. */
export function computePregnancyWeek(dueDate: string | null, now: number = Date.now()): number | null {
  if (!dueDate) return null;
  const TOTAL_DAYS = 280;
  const msPerDay = 24 * 60 * 60 * 1000;
  const dueTime = new Date(dueDate).getTime();
  if (isNaN(dueTime)) return null;
  const daysUntilDue = Math.round((dueTime - now) / msPerDay);
  const daysElapsed = Math.max(0, Math.min(TOTAL_DAYS, TOTAL_DAYS - daysUntilDue));
  return Math.min(40, Math.floor(daysElapsed / 7));
}