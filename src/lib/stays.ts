// Pure rules for a mother's birth stay at the clinic (users/{uid}/stays/{id}),
// entered by staff. No Firebase imports, so it can be unit-tested with plain
// Node. Times are entered as Philippine date and time ("YYYY-MM-DDTHH:mm",
// UTC+8, no DST) and kept as epoch milliseconds here.

export type StayOutcome = 'live' | 'stillbirth';
export type BabySex = 'male' | 'female';

/** A stay as stored, times in epoch ms (null when not recorded). */
export interface Stay {
  admittedAt: number;
  deliveredAt: number | null;
  outcome: StayOutcome | null;
  babySex: BabySex | null;
  birthWeightG: number | null;
  birthLengthCm: number | null;
  dischargedAt: number | null;
  transferredAt: number | null;
}

/** What the admin form sends: Manila "YYYY-MM-DDTHH:mm" strings ('' = none). */
export interface StayInput {
  admittedAt?: unknown;
  deliveredAt?: unknown;
  outcome?: unknown;
  babySex?: unknown;
  birthWeightG?: unknown;
  birthLengthCm?: unknown;
  dischargedAt?: unknown;
  transferredAt?: unknown;
}

export type StayField = keyof StayInput;

const LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const OFFSET_MS = 8 * 60 * 60 * 1000;

/** Manila "YYYY-MM-DDTHH:mm" -> epoch ms, or null when not a real date and time. */
export function parseManila(value: string): number | null {
  const m = LOCAL.exec(value);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  if (h > 23 || mi > 59) return null;
  const ms = Date.UTC(y, mo - 1, d, h, mi) - OFFSET_MS;
  const back = new Date(ms + OFFSET_MS);
  return back.getUTCFullYear() === y && back.getUTCMonth() === mo - 1 && back.getUTCDate() === d ? ms : null;
}

/** Epoch ms -> Manila "YYYY-MM-DDTHH:mm" (the form's value). */
export function toManilaInput(ms: number | null): string {
  if (ms === null) return '';
  return new Date(ms + OFFSET_MS).toISOString().slice(0, 16);
}

/** Epoch ms -> Manila "YYYY-MM-DD". */
export function manilaDay(ms: number): string {
  return new Date(ms + OFFSET_MS).toISOString().slice(0, 10);
}

/** End of a stay for overlap checks: discharge, else transfer, else open. */
function stayEnd(s: Stay): number {
  return s.dischargedAt ?? s.transferredAt ?? Number.POSITIVE_INFINITY;
}

/** Twins: two stays of one mother with the same admission and delivery
 *  time are one delivery with two newborns (one stay per newborn). */
export function isTwinEntry(a: Stay, b: Stay): boolean {
  return a.deliveredAt !== null && a.admittedAt === b.admittedAt && a.deliveredAt === b.deliveredAt;
}

/** True when two stays share any moment (an open stay runs on forever). */
export function staysOverlap(a: Stay, b: Stay): boolean {
  return a.admittedAt < stayEnd(b) && b.admittedAt < stayEnd(a);
}

/**
 * Checks a stay from the admin form. `others` are the patient's other
 * stays (the one being edited left out). Returns the stay or one message
 * per field, shown next to that field.
 */
export function validateStay(
  input: StayInput,
  others: Stay[],
  now: number
): { ok: true; stay: Stay } | { ok: false; errors: Partial<Record<StayField, string>> } {
  const errors: Partial<Record<StayField, string>> = {};
  const time = (field: StayField, required: boolean): number | null => {
    const v = input[field];
    if (v === undefined || v === null || v === '') {
      if (required) errors[field] = 'Required.';
      return null;
    }
    const ms = typeof v === 'string' ? parseManila(v) : null;
    if (ms === null) errors[field] = 'Enter a real date and time.';
    return ms;
  };
  const number = (field: StayField, min: number, max: number, unit: string): number | null => {
    const v = input[field];
    if (v === undefined || v === null || v === '') return null;
    const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d+(\.\d+)?$/.test(v.trim()) ? Number(v) : NaN;
    if (!Number.isFinite(n) || n < min || n > max) {
      errors[field] = `Between ${min} and ${max} ${unit}.`;
      return null;
    }
    return n;
  };

  const admittedAt = time('admittedAt', true);
  const deliveredAt = time('deliveredAt', false);
  const dischargedAt = time('dischargedAt', false);
  const transferredAt = time('transferredAt', false);

  let outcome: StayOutcome | null = null;
  if (input.outcome === 'live' || input.outcome === 'stillbirth') outcome = input.outcome;
  else if (input.outcome !== undefined && input.outcome !== null && input.outcome !== '') errors.outcome = 'Choose live birth or stillbirth.';
  let babySex: BabySex | null = null;
  if (input.babySex === 'male' || input.babySex === 'female') babySex = input.babySex;
  else if (input.babySex !== undefined && input.babySex !== null && input.babySex !== '') errors.babySex = 'Choose male or female.';

  const birthWeightG = number('birthWeightG', 300, 7000, 'g');
  const birthLengthCm = number('birthLengthCm', 20, 70, 'cm');

  if (admittedAt !== null && admittedAt > now) errors.admittedAt = "Admission can't be in the future.";
  if (deliveredAt !== null) {
    if (admittedAt !== null && deliveredAt < admittedAt) errors.deliveredAt = 'Delivery must be on or after admission.';
    if (deliveredAt > now) errors.deliveredAt = "Delivery can't be in the future.";
    if (!outcome && !errors.outcome) errors.outcome = 'Required when there is a delivery.';
    if (outcome === 'live' && !babySex && !errors.babySex) errors.babySex = 'Required for a live birth.';
  } else {
    if (outcome) errors.outcome = 'Enter the delivery time first.';
    if (babySex) errors.babySex = 'Enter the delivery time first.';
  }
  if (outcome === 'stillbirth' && babySex) errors.babySex = 'Leave empty for a stillbirth.';
  if ((birthWeightG !== null || birthLengthCm !== null) && outcome !== 'live') {
    if (birthWeightG !== null) errors.birthWeightG = 'Only for a live birth.';
    if (birthLengthCm !== null) errors.birthLengthCm = 'Only for a live birth.';
  }
  if (dischargedAt !== null) {
    if (admittedAt !== null && dischargedAt < admittedAt) errors.dischargedAt = 'Discharge must be on or after admission.';
    else if (deliveredAt !== null && dischargedAt < deliveredAt) errors.dischargedAt = 'Discharge must be on or after delivery.';
    if (dischargedAt > now) errors.dischargedAt = "Discharge can't be in the future.";
  }
  if (transferredAt !== null) {
    if (admittedAt !== null && transferredAt < admittedAt) errors.transferredAt = 'Transfer must be on or after admission.';
    if (transferredAt > now) errors.transferredAt = "Transfer can't be in the future.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const stay: Stay = {
    admittedAt: admittedAt!, deliveredAt, outcome, babySex, birthWeightG, birthLengthCm, dischargedAt, transferredAt,
  };
  if (others.some((o) => staysOverlap(stay, o) && !isTwinEntry(stay, o))) {
    return { ok: false, errors: { admittedAt: "This overlaps another of this patient's stays." } };
  }
  return { ok: true, stay };
}
