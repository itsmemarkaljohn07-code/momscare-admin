// A patient's name from her profile. The app's newer version writes
// firstName, middleName (optional) and lastName and keeps fullName =
// "First Middle Last"; older accounts only have fullName. Pure: no
// Firebase imports. Never used to write anything back.

export interface NameParts {
  first: string;
  middle: string;
  last: string;
  /** "First Middle Last", single spaces; '' when nothing is set. */
  full: string;
}

export interface NameSource {
  fullName?: unknown;
  firstName?: unknown;
  middleName?: unknown;
  lastName?: unknown;
}

/** The profile fields a name needs, for select() / fieldMask. */
export const NAME_FIELDS = ['fullName', 'firstName', 'middleName', 'lastName'] as const;

const clean = (v: unknown) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '');

/** First, middle, last and full name. The parts win when firstName or
 *  lastName is set; otherwise fullName is split into the first word and
 *  the rest (no middle name). */
export function patientNameParts(p: NameSource | null | undefined): NameParts {
  const first = clean(p?.firstName);
  const middle = clean(p?.middleName);
  const last = clean(p?.lastName);
  if (first || last) {
    return { first, middle, last, full: [first, middle, last].filter(Boolean).join(' ') };
  }
  const full = clean(p?.fullName);
  if (!full) return { first: '', middle: '', last: '', full: '' };
  const space = full.indexOf(' ');
  return space < 0
    ? { first: full, middle: '', last: '', full }
    : { first: full.slice(0, space), middle: '', last: full.slice(space + 1), full };
}

/** The full name to show, or `fallback` when the profile has none. */
export function patientName(p: NameSource | null | undefined, fallback = ''): string {
  return patientNameParts(p).full || fallback;
}

/** Case-insensitive search: every word of the query must appear in the
 *  first, middle, last or full name (extra spaces ignored). */
export function matchesName(parts: NameParts, query: string): boolean {
  const words = clean(query).toLowerCase().split(' ').filter(Boolean);
  if (words.length === 0) return true;
  const hay = [parts.first, parts.middle, parts.last, parts.full].join(' ').toLowerCase();
  return words.every((w) => hay.includes(w));
}
