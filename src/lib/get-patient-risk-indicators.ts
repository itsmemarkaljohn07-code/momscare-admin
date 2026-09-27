import { adminDb } from '@/lib/firebase-admin';
import { getUsers } from '@/lib/get-users';
import { getAppointments } from '@/lib/get-appointments';
import { computePregnancyWeek } from '@/lib/compute-pregnancy-week';
import { withRetry } from '@/lib/with-retry';

export interface PatientRiskFlag {
  uid: string;
  fullName: string;
  dueDate: string | null;
  currentWeek: number | null;
  reasons: string[];
}

// Thresholds — kept as named constants rather than magic numbers, so
// the heuristic is easy to find and adjust later without hunting
// through the logic below.
const MIN_WEEK_TO_EXPECT_APPOINTMENT = 12; // first trimester scans typically start around here
const DECLINED_APPOINTMENT_THRESHOLD = 2;
const SNAPSHOT_STALE_DAYS = 21; // roughly 3 weeks with no photo logged
const MIN_WEEK_TO_EXPECT_FIRST_SNAPSHOT = 8;

/** One collectionGroup query across every patient's snapshots,
 *  reduced in-memory to the single most recent timestamp per patient
 *  — same collectionGroup pattern already used for reading every
 *  patient's appointments at once, just applied to snapshots. */
async function getLastSnapshotTimestamps(): Promise<Map<string, string>> {
  const snapshot = await withRetry(() => adminDb.collectionGroup('snapshots').get());
  const map = new Map<string, string>();
  for (const doc of snapshot.docs) {
    const patientUid = doc.ref.parent.parent?.id;
    if (!patientUid) continue;
    const createdAt = doc.data().createdAt?.toDate?.().toISOString();
    if (!createdAt) continue;
    const existing = map.get(patientUid);
    if (!existing || createdAt > existing) map.set(patientUid, createdAt);
  }
  return map;
}

export async function getPatientRiskIndicators(): Promise<PatientRiskFlag[]> {
  const [users, appointments, lastSnapshotByUid] = await Promise.all([
    getUsers(),
    getAppointments(),
    getLastSnapshotTimestamps(),
  ]);

  const appointmentsByPatient = new Map<string, typeof appointments>();
  for (const a of appointments) {
    if (!appointmentsByPatient.has(a.patientUid)) appointmentsByPatient.set(a.patientUid, []);
    appointmentsByPatient.get(a.patientUid)!.push(a);
  }

  const flags: PatientRiskFlag[] = [];

  for (const u of users) {
    // A suspended account isn't "falling through the cracks" — it's
    // deliberately blocked, a different situation entirely.
    if (u.disabled) continue;

    const reasons: string[] = [];
    const week = computePregnancyWeek(u.dueDate);
    const patientAppointments = appointmentsByPatient.get(u.uid) ?? [];

    // Factor 1: no appointment on the books despite advancing week
    const hasUpcomingAppointment = patientAppointments.some((a) => a.status === 'upcoming');
    if (week !== null && week >= MIN_WEEK_TO_EXPECT_APPOINTMENT && !hasUpcomingAppointment) {
      reasons.push(
        patientAppointments.length === 0
          ? 'No appointment ever scheduled'
          : 'No upcoming appointment scheduled'
      );
    }

    // Factor 2: repeatedly declined appointments
    const declinedCount = patientAppointments.filter((a) => a.doctorApproval === 'rejected').length;
    if (declinedCount >= DECLINED_APPOINTMENT_THRESHOLD) {
      reasons.push(`${declinedCount} declined appointments`);
    }

    // Factor 3: snapshot not logged in an unusually long time
    const lastSnapshot = lastSnapshotByUid.get(u.uid);
    if (!lastSnapshot) {
      if (week !== null && week >= MIN_WEEK_TO_EXPECT_FIRST_SNAPSHOT) {
        reasons.push('No snapshot ever uploaded');
      }
    } else {
      const daysSince = Math.floor((Date.now() - new Date(lastSnapshot).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince >= SNAPSHOT_STALE_DAYS) {
        reasons.push(`No snapshot in ${daysSince} days`);
      }
    }

    if (reasons.length > 0) {
      flags.push({ uid: u.uid, fullName: u.fullName, dueDate: u.dueDate, currentWeek: week, reasons });
    }
  }

  // Most flags first — the patients most likely to need attention rise to the top.
  return flags.sort((a, b) => b.reasons.length - a.reasons.length);
}