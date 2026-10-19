import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/get-admin-session';
import { getUsers } from '@/lib/get-users';
import { reportActor } from '@/lib/report-actor';
import { buildPatientReport, type ReportPatient } from '@/lib/report-aggregations';

/**
 * Admin only. GET: the patient summary report's numbers, as of today
 * (Manila). Built from the existing patient list; only name, due date,
 * account status and assigned doctors are used: no emails, phone
 * numbers or health readings.
 */
export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }
  try {
    const [users, generatedBy] = await Promise.all([getUsers(), reportActor(session)]);
    const patients: ReportPatient[] = users.map((u) => ({
      name: u.fullName,
      dueDate: u.dueDate ?? null,
      disabled: u.disabled,
      doctors: Array.isArray(u.assignedDoctorNames) ? u.assignedDoctorNames : [],
    }));
    return NextResponse.json({ generatedBy, report: buildPatientReport(patients, new Date()) });
  } catch (err: unknown) {
    console.error('Failed to build patient report:', (err as { code?: unknown })?.code ?? (err as Error)?.message ?? 'unknown');
    return NextResponse.json({ error: 'Could not build the report. Please try again.' }, { status: 500 });
  }
}
