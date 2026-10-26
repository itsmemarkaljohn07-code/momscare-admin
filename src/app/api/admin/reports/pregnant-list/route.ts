import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getAdminSession } from '@/lib/get-admin-session';
import { getUsers } from '@/lib/get-users';
import { withRetry } from '@/lib/with-retry';
import { logAuditEvent } from '@/lib/audit-log';
import { patientNameParts } from '@/lib/patient-name';
import { buildPregnantList, isDayKey, listBarangays, type ListPatient } from '@/lib/pregnant-list';

/**
 * Admin only. GET ?date=YYYY-MM-DD[&barangay=...][&export=1&format=pdf|csv]:
 * the List of Pregnant Women for a report date. Without export=1 it
 * returns counts and the barangay list only (the on-screen preview never
 * gets names or addresses); with export=1 it returns the rows for the
 * file and records one audit entry ("List of Pregnant Women, PDF"/"CSV",
 * no names or values). Plain reads through the Admin SDK, no index.
 */
export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const p = req.nextUrl.searchParams;
  const reportDate = p.get('date');
  if (!isDayKey(reportDate)) {
    return NextResponse.json({ error: 'Choose a report date.' }, { status: 400 });
  }
  const barangay = (p.get('barangay') ?? '').trim().slice(0, 120) || null;
  const exporting = p.get('export') === '1';
  const format = p.get('format') ?? 'pdf';
  if (exporting && format !== 'pdf' && format !== 'csv') {
    return NextResponse.json({ error: 'Choose PDF or CSV.' }, { status: 400 });
  }

  try {
    const [users, apptSnap, staySnap] = await Promise.all([
      getUsers(),
      withRetry(() => adminDb.collectionGroup('appointments').select('label', 'status', 'date').get()),
      withRetry(() => adminDb.collectionGroup('stays').select('deliveredAt').get()),
    ]);
    // getUsers() already leaves out admins and doctors; it has no address
    // or raw due date, so read those from the same profiles.
    const profiles = new Map((await withRetry(() => adminDb.collection('users').select('address', 'dueDate').get())).docs.map((d) => [d.id, d]));
    const patients: ListPatient[] = users.map((u) => ({
      uid: u.uid,
      name: patientNameParts({ fullName: u.fullName, firstName: u.firstName, middleName: u.middleName, lastName: u.lastName }),
      dob: u.dob,
      address: profiles.get(u.uid)?.get('address') ?? null,
      dueDate: profiles.get(u.uid)?.get('dueDate') ?? null,
    }));
    const patientUids = new Set(patients.map((x) => x.uid));
    const appointments = apptSnap.docs
      .map((d) => ({
        patientUid: d.ref.parent.parent?.id ?? '',
        label: String(d.get('label') ?? ''),
        status: String(d.get('status') ?? ''),
        date: String(d.get('date') ?? ''),
      }))
      .filter((a) => patientUids.has(a.patientUid));
    const stays = staySnap.docs
      .map((d) => ({ patientUid: d.ref.parent.parent?.id ?? '', deliveredAt: d.get('deliveredAt')?.toMillis?.() ?? null }))
      .filter((s) => patientUids.has(s.patientUid));

    const list = buildPregnantList({ reportDate, barangay, patients, appointments, stays });

    if (!exporting) {
      return NextResponse.json({ reportDate, barangay, counts: list.counts, barangays: listBarangays(patients) });
    }

    await logAuditEvent({
      actorUid: session.uid,
      actorEmail: session.email ?? 'unknown',
      actorRole: 'admin',
      action: 'report.pregnant_list_export',
      targetType: 'report',
      targetId: `pregnant-list-${reportDate}`,
      targetLabel: 'List of Pregnant Women',
      details: `List of Pregnant Women, ${format === 'csv' ? 'CSV' : 'PDF'}`,
    });
    return NextResponse.json({ list, generatedAt: new Date().toISOString() });
  } catch (err: unknown) {
    console.error('Failed to build the list of pregnant women:', (err as { code?: unknown })?.code ?? (err as Error)?.message ?? 'unknown');
    return NextResponse.json({ error: 'Could not build the list. Please try again.' }, { status: 500 });
  }
}
