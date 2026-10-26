// Pure helpers for the profile fields the mobile app saves for each mother:
// her birthday (users/{uid}.dob) and address (users/{uid}.address). No
// Firebase imports, so it can be unit-tested with plain Node. The age is
// never stored; it is worked out from the birthday on a Philippine date.

import { ageOn, dobKey } from '@/lib/date-of-birth';
import { formatDateKey } from '@/lib/pregnancy-display';
import { manilaKey } from '@/lib/report-aggregations';

export const NOT_SET = 'Not set';

export interface PatientAddress {
  province: string;
  city: string;
  barangay: string;
  street: string;
}

const clean = (v: unknown) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '');

/**
 * The stored address as its four parts, trimmed, or null when nothing is
 * filled in. The app saves a map { province, city, barangay, street }; an
 * older account may hold a plain string, read as the street line.
 */
export function readAddress(stored: unknown): PatientAddress | null {
  let a: PatientAddress;
  if (typeof stored === 'string') {
    a = { province: '', city: '', barangay: '', street: clean(stored) };
  } else if (stored && typeof stored === 'object') {
    const m = stored as Record<string, unknown>;
    a = { province: clean(m.province), city: clean(m.city), barangay: clean(m.barangay), street: clean(m.street) };
  } else {
    return null;
  }
  return a.province || a.city || a.barangay || a.street ? a : null;
}

/** "Purok 1, Barangay, City, Province": only the parts that are filled. */
export function formatAddress(a: PatientAddress | null): string | null {
  if (!a) return null;
  const line = [a.street, a.barangay, a.city, a.province].filter(Boolean).join(', ');
  return line || null;
}

/** The birthday's age on a Philippine date ("YYYY-MM-DD"), or null. The
 *  stored value may be "YYYY-MM-DD", an older ISO timestamp, '' or missing. */
export function ageOnDate(storedDob: unknown, dateKey: string): number | null {
  const dob = dobKey(storedDob);
  if (!dob) return null;
  const age = ageOn(dob, dateKey);
  return age !== null && age >= 0 ? age : null;
}

/** The age today in Manila, or null. */
export function ageToday(storedDob: unknown, now: Date = new Date()): number | null {
  return ageOnDate(storedDob, manilaKey(now));
}

/** "May 1, 1996", or null. */
export function formatBirthday(storedDob: unknown): string | null {
  const dob = dobKey(storedDob);
  return dob ? formatDateKey(dob, { month: 'long', day: 'numeric', year: 'numeric' }) : null;
}

/** "27 y/o", or null. */
export function ageLabel(age: number | null): string | null {
  return age === null ? null : `${age} y/o`;
}
