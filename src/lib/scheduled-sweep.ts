import { adminDb } from '@/lib/firebase-admin';
import { isMissedAppointment } from '@/lib/appointment-status';
import { markAppointmentMissed } from '@/lib/mark-missed';
import { syncDoctorReplyNotifications } from '@/lib/doctor-notifications';

/** Appointments marked per run, so one run stays well inside the
 *  serverless time limit; the next run picks up the rest. */
const MAX_MISSED_PER_RUN = 50;
/** Stop starting new work after this long. */
const TIME_BUDGET_MS = 45_000;

export interface SweepResult {
  dryRun: boolean;
  appointmentsChecked: number;
  missedDue: number;
  missedMarked: number;
  missedUnchanged: number;
  missedFailed: number;
  /** id prefix + date of each due appointment (no names or details). */
  missedSample: { id: string; date: string }[];
  doctorsChecked: number;
  doctorsTotal: number;
  stoppedEarly: boolean;
  durationMs: number;
}

/**
 * The work an open staff page does, run on a schedule instead so it also
 * happens with nobody signed in:
 *  1. marks appointments missed 3 hours after their start (and notifies
 *     the patient once), via the same markAppointmentMissed as the page;
 *  2. runs the patient-reply check for every doctor, so their bell entries
 *     are waiting the next time they open the dashboard.
 *
 * Reads appointments with one plain collection-group get of three fields
 * (no index needed). With dryRun nothing is written and step 2 is skipped,
 * since the reply check creates records as it goes.
 */
export async function runScheduledSweep({ dryRun }: { dryRun: boolean }): Promise<SweepResult> {
  const startedAt = Date.now();
  const outOfTime = () => Date.now() - startedAt > TIME_BUDGET_MS;
  const result: SweepResult = {
    dryRun,
    appointmentsChecked: 0,
    missedDue: 0,
    missedMarked: 0,
    missedUnchanged: 0,
    missedFailed: 0,
    missedSample: [],
    doctorsChecked: 0,
    doctorsTotal: 0,
    stoppedEarly: false,
    durationMs: 0,
  };

  // 1. Missed appointments.
  const now = new Date();
  const snap = await adminDb.collectionGroup('appointments').select('status', 'date', 'time').get();
  result.appointmentsChecked = snap.size;
  const due = snap.docs
    .map((d) => ({
      id: d.id,
      uid: d.ref.parent.parent?.id ?? '',
      date: String(d.get('date') ?? ''),
      time: String(d.get('time') ?? ''),
      status: String(d.get('status') ?? ''),
    }))
    .filter((a) => a.uid && a.status === 'upcoming' && isMissedAppointment(a, now))
    .sort((a, b) => a.date.localeCompare(b.date));
  result.missedDue = due.length;

  for (const a of due.slice(0, MAX_MISSED_PER_RUN)) {
    result.missedSample.push({ id: `${a.id.slice(0, 6)}…`, date: a.date });
    if (dryRun) continue;
    if (outOfTime()) {
      result.stoppedEarly = true;
      break;
    }
    try {
      const outcome = await markAppointmentMissed(a.uid, a.id);
      if (outcome === 'marked') result.missedMarked++;
      else result.missedUnchanged++;
    } catch (err) {
      result.missedFailed++;
      console.error('[sweep] mark missed failed:', (err as { code?: unknown })?.code ?? 'unknown');
    }
  }

  // 2. Patient replies for every doctor (writes records, so not in a dry run).
  const doctors = await adminDb.collection('doctors').select('name').get();
  result.doctorsTotal = doctors.size;
  if (!dryRun) {
    for (const d of doctors.docs) {
      if (outOfTime()) {
        result.stoppedEarly = true;
        break;
      }
      const name = d.get('name');
      if (typeof name !== 'string' || !name.trim()) continue;
      await syncDoctorReplyNotifications(d.id, name); // never throws
      result.doctorsChecked++;
    }
  }

  result.durationMs = Date.now() - startedAt;
  return result;
}
