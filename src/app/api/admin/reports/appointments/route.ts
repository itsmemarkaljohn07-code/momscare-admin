import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getAdminSession } from '@/lib/get-admin-session';
import { getUsers } from '@/lib/get-users';
import { reportActor } from '@/lib/report-actor';
import { buildAppointmentReport, validRange, type ReportAppointment } from '@/lib/report-aggregations';

/** Most appointments read for one report; above this the report says so. */
const MAX_APPOINTMENTS = 5000;

/**
 * Admin only. GET ?from&to (Manila dates, YYYY-MM-DD, both optional):
 * the appointment report's numbers. One plain collection-group read of the
 * fields the report needs (no index), at most 5000 appointments; patient
 * names from the existing user lookup. No reasons or notes are read.
 */
export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const p = req.nextUrl.searchParams;
  const range = { from: p.get('from') || null, to: p.get('to') || null };
  if (!validRange(range)) {
    return NextResponse.json({ error: 'Choose a valid period (from must be on or before to).' }, { status: 400 });
  }

  try {
    const [snap, users, generatedBy] = await Promise.all([
      adminDb
        .collectionGroup('appointments')
        .select('label', 'doctor', 'date', 'time', 'status', 'cancellation.state')
        .limit(MAX_APPOINTMENTS + 1)
        .get(),
      getUsers(),
      reportActor(session),
    ]);
    const names = new Map(users.map((u) => [u.uid, u.fullName]));
    const capped = snap.size > MAX_APPOINTMENTS;
    const rows: ReportAppointment[] = snap.docs.slice(0, MAX_APPOINTMENTS).map((d) => ({
      patientName: names.get(d.ref.parent.parent?.id ?? '') ?? '(unknown patient)',
      label: String(d.get('label') ?? 'Appointment'),
      doctor: String(d.get('doctor') ?? ''),
      date: String(d.get('date') ?? ''),
      time: String(d.get('time') ?? ''),
      status: String(d.get('status') ?? ''),
      cancellationState: typeof d.get('cancellation.state') === 'string' ? d.get('cancellation.state') : null,
    }));

    return NextResponse.json({
      generatedBy,
      maxAppointments: MAX_APPOINTMENTS,
      report: buildAppointmentReport(rows, range, new Date(), capped),
    });
  } catch (err: unknown) {
    console.error('Failed to build appointment report:', (err as { code?: unknown })?.code ?? (err as Error)?.message ?? 'unknown');
    return NextResponse.json({ error: 'Could not build the report. Please try again.' }, { status: 500 });
  }
}
