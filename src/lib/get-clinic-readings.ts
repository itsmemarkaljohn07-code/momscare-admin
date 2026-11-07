import { adminDb } from '@/lib/firebase-admin';
import { withRetry } from '@/lib/with-retry';
import { isRealDay, readingFromData, sortReadings, type ClinicReading } from '@/lib/clinic-readings';

export type ClinicReadingRow = ClinicReading & { id: string };

/**
 * One patient's clinic readings for the admin patient page (server only,
 * Admin SDK; the page calls it directly, no route). Newest first. A reading
 * with an unreadable measuredOn is left out; a value that is not a number
 * reads as null. Viewing is not audited, like the rest of the page.
 */
export async function getClinicReadings(uid: string): Promise<{ rows: ClinicReadingRow[] } | { error: true }> {
  try {
    const snap = await withRetry(() => adminDb.collection('users').doc(uid).collection('clinicReadings').get());
    const rows = snap.docs.map((d) => readingFromData(d.id, d.data())).filter((r) => isRealDay(r.measuredOn));
    return { rows: sortReadings(rows) };
  } catch (err: unknown) {
    console.error('Failed to load clinic readings:', (err as { code?: unknown })?.code ?? 'unknown');
    return { error: true };
  }
}
