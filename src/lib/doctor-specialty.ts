// Server-side check for a doctor's specialty: one from the list, or the
// text an admin typed for "Other" (trimmed, 2 to 40 characters).

export const SPECIALTY_MIN = 2;
export const SPECIALTY_MAX = 40;

/** The trimmed specialty, or null when it is missing or the wrong length. */
export function cleanSpecialty(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const s = value.trim().replace(/\s+/g, ' ');
  return s.length >= SPECIALTY_MIN && s.length <= SPECIALTY_MAX ? s : null;
}

export const SPECIALTY_ERROR = `Enter a specialty of ${SPECIALTY_MIN} to ${SPECIALTY_MAX} characters.`;
