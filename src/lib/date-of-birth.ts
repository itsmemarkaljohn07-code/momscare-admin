// Pure rules for a patient's date of birth (entered by an admin). No
// Firebase imports, so it can be unit-tested with plain Node. Dates are
// Philippine calendar dates, "YYYY-MM-DD".

import { dueKey } from '@/lib/report-aggregations';

export const DOB_MIN_AGE = 10;
export const DOB_MAX_AGE = 60;

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A stored date of birth (the app may hold "YYYY-MM-DD" or an ISO
 *  timestamp) as a Philippine date key, or null. */
export function dobKey(stored: unknown): string | null {
  return typeof stored === 'string' && stored ? dueKey(stored) : null;
}

/** Full years between a date of birth and a date (both "YYYY-MM-DD"). A
 *  29 February birthday counts from 1 March in non-leap years. */
export function ageOn(dob: string, on: string): number | null {
  const a = DAY.exec(dob);
  const b = DAY.exec(on);
  if (!a || !b) return null;
  const [by, bm, bd] = [Number(a[1]), Number(a[2]), Number(a[3])];
  const [oy, om, od] = [Number(b[1]), Number(b[2]), Number(b[3])];
  let age = oy - by;
  if (om < bm || (om === bm && od < bd)) age--;
  return age;
}

/** True when "YYYY-MM-DD" is a real calendar date. */
export function isRealDate(value: string): boolean {
  const m = DAY.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

/** Validates an admin-entered date of birth against today's Philippine
 *  date: a real date, not in the future, age 10 to 60 today. */
export function validateDob(value: unknown, today: string): { ok: true; dob: string } | { ok: false; error: string } {
  if (typeof value !== 'string' || !isRealDate(value)) return { ok: false, error: 'Enter a real date (YYYY-MM-DD).' };
  if (value > today) return { ok: false, error: "The date of birth can't be in the future." };
  const age = ageOn(value, today);
  if (age === null || age < DOB_MIN_AGE || age > DOB_MAX_AGE) {
    return { ok: false, error: `The patient's age must be between ${DOB_MIN_AGE} and ${DOB_MAX_AGE} today.` };
  }
  return { ok: true, dob: value };
}
