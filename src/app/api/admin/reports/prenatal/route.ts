import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getAdminSession } from '@/lib/get-admin-session';
import { withRetry } from '@/lib/with-retry';
import { logAuditEvent } from '@/lib/audit-log';
import { reportActor } from '@/lib/report-actor';
import { dueKey } from '@/lib/report-aggregations';
import { dobKey } from '@/lib/date-of-birth';
import { buildPrenatalReport, isMonthKey, type PrenatalAppointment, type PrenatalPatient } from '@/lib/prenatal-report';
import { docToStay } from '@/lib/stay-store';
import { staysOfExistingPatients, type ReportStay } from '@/lib/stay-report';

/**
 * Admin only. GET ?month=YYYY-MM[&export=1&format=pdf|csv]: the month's Prenatal
 * Services numbers (an internal draft, not an official submission). One
 * plain collection-group read of four appointment fields (no index), then
 * the profiles of the patients in the month. ?export=1 (a PDF or CSV
 * download) also records an audit entry whose details are just the format;
 * the on-screen preview doesn't. The file itself is built in the browser.
 */
export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const month = req.nextUrl.searchParams.get('month');
  if (!isMonthKey(month)) {
    return NextResponse.json({ error: 'Choose a month (YYYY-MM).' }, { status: 400 });
  }
  const exporting = req.nextUrl.searchParams.get('export') === '1';
  const format = req.nextUrl.searchParams.get('format') ?? 'pdf';
  if (exporting && format !== 'pdf' && format !== 'csv') {
    return NextResponse.json({ error: 'Choose PDF or CSV.' }, { status: 400 });
  }

  try {
    const [snap, staySnap] = await Promise.all([
      withRetry(() => adminDb.collectionGroup('appointments').select('label', 'status', 'date', 'doctorApproval').get()),
      // Birth stays of registered patients; each is counted by event date.
      withRetry(() =>
        adminDb.collectionGroup('stays')
          .select('admittedAt', 'deliveredAt', 'outcome', 'babySex', 'birthWeightG', 'birthLengthCm', 'dischargedAt', 'transferredAt')
          .get()
      ),
    ]);
    const allStays: ReportStay[] = staySnap.docs
      .map((d) => ({ patientUid: d.ref.parent.parent?.id ?? '', ...docToStay(d.data()) }))
      .filter((s) => s.patientUid && s.admittedAt > 0);
    const appointments: PrenatalAppointment[] = snap.docs
      .map((d) => ({
        patientUid: d.ref.parent.parent?.id ?? '',
        label: String(d.get('label') ?? ''),
        status: String(d.get('status') ?? ''),
        date: String(d.get('date') ?? ''),
        doctorApproval: String(d.get('doctorApproval') ?? 'pending'),
      }))
      .filter((a) => a.patientUid && a.date.startsWith(`${month}-`));

    const uids = [...new Set([...appointments.map((a) => a.patientUid), ...allStays.map((s) => s.patientUid)])];
    const profiles = uids.length
      ? await adminDb.getAll(...uids.map((uid) => adminDb.collection('users').doc(uid)), { fieldMask: ['fullName', 'dob', 'dueDate'] })
      : [];
    const patients: PrenatalPatient[] = profiles.map((p) => ({
      uid: p.id,
      name: String(p.get('fullName') ?? '').trim() || 'Unknown patient',
      dob: dobKey(p.get('dob')),
      dueDate: dueKey(typeof p.get('dueDate') === 'string' ? p.get('dueDate') : null),
    }));

    // Stays left under a deleted patient's id are not counted.
    const stays = staysOfExistingPatients(allStays, new Set(profiles.filter((p) => p.exists).map((p) => p.id)));
    const report = buildPrenatalReport({ month, appointments, patients, stays, now: new Date() });
    const generatedBy = await reportActor(session);

    if (exporting) {
      await logAuditEvent({
        actorUid: session.uid,
        actorEmail: session.email ?? 'unknown',
        actorRole: 'admin',
        action: 'report.prenatal_export',
        targetType: 'report',
        targetId: `prenatal-${month}`,
        targetLabel: `Prenatal services ${month}`,
        details: format === 'csv' ? 'CSV' : 'PDF',
      });
    }

    return NextResponse.json({ generatedBy, report });
  } catch (err: unknown) {
    console.error('Failed to build prenatal report:', (err as { code?: unknown })?.code ?? (err as Error)?.message ?? 'unknown');
    return NextResponse.json({ error: 'Could not build the report. Please try again.' }, { status: 500 });
  }
}
