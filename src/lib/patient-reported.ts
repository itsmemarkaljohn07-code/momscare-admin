// The latest weight and blood pressure a patient logged with a Snapshot,
// for the "Patient-reported (latest)" line. Pure; photos come newest first.

export interface PatientReported {
  weightKg: number | null;
  bpSys: number | null;
  bpDia: number | null;
  /** ISO time of that Snapshot. */
  at: string | null;
}

interface PhotoHealth {
  createdAt: string | null;
  healthSnapshot?: { weight?: unknown; bpSys?: unknown; bpDia?: unknown } | null;
}

const positive = (v: unknown) => (typeof v === 'number' && v > 0 ? v : null);

/** The newest Snapshot with a weight or a full blood pressure, or null. */
export function latestPatientReported(photosNewestFirst: PhotoHealth[]): PatientReported | null {
  const latest = photosNewestFirst.find((p) => {
    const h = p.healthSnapshot;
    return h && (positive(h.weight) !== null || (positive(h.bpSys) !== null && positive(h.bpDia) !== null));
  });
  const h = latest?.healthSnapshot;
  if (!latest || !h) return null;
  return {
    weightKg: positive(h.weight),
    bpSys: positive(h.bpDia) !== null ? positive(h.bpSys) : null,
    bpDia: positive(h.bpSys) !== null ? positive(h.bpDia) : null,
    at: latest.createdAt,
  };
}
