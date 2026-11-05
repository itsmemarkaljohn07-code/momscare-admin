// Pure rules for a clinic health reading (users/{uid}/clinicReadings/{id}),
// entered by the assigned doctor. No Firebase imports, so it can be
// unit-tested with plain Node. The mobile app reads the same documents, so
// the stored shape is a contract: weight always in kg, blood pressure in
// mmHg, measuredOn a Philippine calendar date ("YYYY-MM-DD").

export const WEIGHT_MIN = 30;
export const WEIGHT_MAX = 250;
export const SYS_MIN = 60;
export const SYS_MAX = 260;
export const DIA_MIN = 30;
export const DIA_MAX = 160;
export const NOTE_MAX = 300;
// The ranges below are typing guards only (they catch a slipped digit),
// never clinical limits: nothing here judges a value normal or not.
export const FUNDAL_MIN = 5;
export const FUNDAL_MAX = 60;
export const FHR_MIN = 60;
export const FHR_MAX = 220;
export const PULSE_MIN = 30;
export const PULSE_MAX = 220;
export const TEMP_MIN = 33;
export const TEMP_MAX = 43;

/** The measured values of a reading, as validated. The four later fields
 *  are optional in stored documents (older readings do not have them). */
export interface ReadingValues {
  weightKg: number | null;
  bpSys: number | null;
  bpDia: number | null;
  fundalHeightCm: number | null;
  fetalHeartRate: number | null;
  pulse: number | null;
  temperatureC: number | null;
  note: string;
  measuredOn: string;
}

/** The six measures of a reading, for "at least one". */
export const MEASURE_FIELDS = ['weightKg', 'bpSys', 'bpDia', 'fundalHeightCm', 'fetalHeartRate', 'pulse', 'temperatureC'] as const;

/** A reading as stored (Firestore Timestamps become epoch ms here). */
export interface ClinicReading extends ReadingValues {
  enteredByUid: string;
  enteredByName: string;
  enteredAt: number;
  updatedAt: number;
}

export type ReadingField = (typeof MEASURE_FIELDS)[number] | 'note' | 'measuredOn' | 'form';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real calendar date written "YYYY-MM-DD". */
export function isRealDay(v: unknown): v is string {
  if (typeof v !== 'string' || !DAY.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

const blank = (v: unknown) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

/** A number from the body: a JSON number or a plain decimal string. */
function toNumber(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && /^\d+(\.\d+)?$/.test(v.trim())) return Number(v.trim());
  return NaN;
}

/**
 * Checks what the doctor's form sends. Only weightKg, bpSys, bpDia, note
 * and measuredOn are read; anything else in the body (an enteredByUid, for
 * one) is ignored. Weight with more than one decimal is rejected, not
 * rounded, so what is stored is exactly what the doctor typed. Errors are
 * per field, shown next to that field. `today` is the Manila date.
 */
export function validateReading(
  body: unknown,
  today: string
): { ok: true; value: ReadingValues } | { ok: false; errors: Partial<Record<ReadingField, string>> } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, errors: { form: 'Send the reading as a JSON object.' } };
  }
  const input = body as Record<string, unknown>;
  const errors: Partial<Record<ReadingField, string>> = {};

  /** At most one decimal; more decimals are rejected, not rounded. */
  const oneDecimal = (field: 'weightKg' | 'fundalHeightCm' | 'temperatureC', min: number, max: number, range: string, example: string): number | null => {
    if (blank(input[field])) return null;
    const n = toNumber(input[field]);
    if (!Number.isFinite(n) || n < min || n > max) errors[field] = `Between ${range}.`;
    else if (Math.abs(n * 10 - Math.round(n * 10)) > 1e-9) errors[field] = `Use at most one decimal, for example ${example}.`;
    else return Math.round(n * 10) / 10;
    return null;
  };
  const weightKg = oneDecimal('weightKg', WEIGHT_MIN, WEIGHT_MAX, `${WEIGHT_MIN} and ${WEIGHT_MAX} kg`, '58.4');
  const fundalHeightCm = oneDecimal('fundalHeightCm', FUNDAL_MIN, FUNDAL_MAX, `${FUNDAL_MIN} and ${FUNDAL_MAX} cm`, '24.5');
  const temperatureC = oneDecimal('temperatureC', TEMP_MIN, TEMP_MAX, `${TEMP_MIN.toFixed(1)} and ${TEMP_MAX.toFixed(1)} °C`, '36.8');

  const whole = (field: 'bpSys' | 'bpDia' | 'fetalHeartRate' | 'pulse', min: number, max: number): number | null => {
    if (blank(input[field])) return null;
    const n = toNumber(input[field]);
    if (!Number.isInteger(n) || n < min || n > max) {
      errors[field] = `A whole number from ${min} to ${max}.`;
      return null;
    }
    return n;
  };
  let bpSys = whole('bpSys', SYS_MIN, SYS_MAX);
  let bpDia = whole('bpDia', DIA_MIN, DIA_MAX);
  const sysGiven = !blank(input.bpSys);
  const diaGiven = !blank(input.bpDia);
  if (sysGiven && !diaGiven) errors.bpDia = 'Enter the diastolic value too.';
  if (diaGiven && !sysGiven) errors.bpSys = 'Enter the systolic value too.';
  if (bpSys !== null && bpDia !== null && bpSys <= bpDia) errors.bpSys = 'Systolic must be higher than diastolic.';
  if (!sysGiven || !diaGiven) {
    bpSys = null;
    bpDia = null;
  }
  const fetalHeartRate = whole('fetalHeartRate', FHR_MIN, FHR_MAX);
  const pulse = whole('pulse', PULSE_MIN, PULSE_MAX);

  if (!blank(input.note) && typeof input.note !== 'string') errors.note = 'The note must be text.';
  const note = typeof input.note === 'string' ? input.note.trim() : '';
  if (note.length > NOTE_MAX) errors.note = `At most ${NOTE_MAX} characters.`;

  const measuredOn = input.measuredOn;
  if (blank(measuredOn)) errors.measuredOn = 'Choose the date of the reading.';
  else if (!isRealDay(measuredOn)) errors.measuredOn = 'Enter a real date.';
  else if (measuredOn > today) errors.measuredOn = 'The date cannot be in the future.';

  // At least one measurement among the six; a field error already explains a refused one.
  if (MEASURE_FIELDS.every((f) => blank(input[f]) && !errors[f])) {
    errors.form = 'Enter at least one measurement.';
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: { weightKg, bpSys, bpDia, fundalHeightCm, fetalHeartRate, pulse, temperatureC, note, measuredOn: measuredOn as string },
  };
}

/** The measured values only, in stored field order. */
function measures(v: ReadingValues) {
  return {
    weightKg: v.weightKg, bpSys: v.bpSys, bpDia: v.bpDia,
    fundalHeightCm: v.fundalHeightCm, fetalHeartRate: v.fetalHeartRate, pulse: v.pulse, temperatureC: v.temperatureC,
    note: v.note, measuredOn: v.measuredOn,
  };
}

/** The document to store for a new reading. Who entered it comes from the
 *  session only, never from the request body. */
export function newReadingDoc<T>(
  value: ReadingValues,
  session: { uid: string; doctorName: string },
  now: T
): ReadingValues & { enteredByUid: string; enteredByName: string; enteredAt: T; updatedAt: T } {
  return {
    ...measures(value),
    enteredByUid: session.uid,
    enteredByName: session.doctorName,
    enteredAt: now,
    updatedAt: now,
  };
}

/** The fields an edit changes: every measured value (a blank one is
 *  stored as null, so it clears) and updatedAt. Who entered the reading,
 *  and when, never change. */
export function editedReadingFields<T>(value: ReadingValues, now: T): ReadingValues & { updatedAt: T } {
  return { ...measures(value), updatedAt: now };
}

/** Newest measuredOn first; the same day by entry time, newest first. */
export function sortReadings<R extends { measuredOn: string; enteredAt: number }>(readings: R[]): R[] {
  return [...readings].sort((a, b) => b.measuredOn.localeCompare(a.measuredOn) || b.enteredAt - a.enteredAt);
}

/** Blood pressure as "120/80", or '' without one. */
export function formatBp(r: { bpSys: number | null; bpDia: number | null }): string {
  return r.bpSys !== null && r.bpDia !== null ? `${r.bpSys}/${r.bpDia}` : '';
}
