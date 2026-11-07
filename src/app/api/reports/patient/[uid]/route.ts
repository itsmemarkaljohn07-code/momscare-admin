import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getAdminSession } from '@/lib/get-admin-session';
import { getDoctorSession } from '@/lib/get-doctor-session';
import { getUserById } from '@/lib/get-users';
import { logAuditEvent } from '@/lib/audit-log';
import { reportActor } from '@/lib/report-actor';
import { validRange } from '@/lib/report-aggregations';
import { buildPatientDetailReport } from '@/lib/patient-detail-report';

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * GET ?from&to: one patient's report data. An admin may export any
 * patient; a doctor only a patient whose assignedDoctorNames contains her
 * name (the same check as the doctor patient page), otherwise 403. No
 * session: 401. Clinical notes are never read. Each export is recorded in
 * the audit log (report.patient_export).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const admin = await getAdminSession();
  const doctor = admin ? null : await getDoctorSession();
  if (!admin && !doctor) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const { uid } = await params;
  const p = req.nextUrl.searchParams;
  const range = { from: p.get('from') || null, to: p.get('to') || null };
  if (!ID_PATTERN.test(uid) || !validRange(range)) {
    return NextResponse.json({ error: 'Choose a valid patient and period.' }, { status: 400 });
  }

  try {
    const user = await getUserById(uid);
    if (!user) {
      // A doctor learns nothing about patients who aren't hers.
      return NextResponse.json({ error: doctor ? 'Not your patient.' : 'Patient not found.' }, { status: doctor ? 403 : 404 });
    }
    if (doctor && !user.assignedDoctorNames.includes(doctor.doctorName)) {
      return NextResponse.json({ error: 'Not your patient.' }, { status: 403 });
    }

    const patientRef = adminDb.collection('users').doc(uid);
    const [appts, snaps, readings, generatedBy] = await Promise.all([
      patientRef.collection('appointments').select('date', 'time', 'label', 'type', 'doctor', 'status', 'doctorApproval').get(),
      patientRef.collection('snapshots').select('createdAt', 'type', 'week', 'caption', 'healthSnapshot').get(),
      // Clinic readings without their note: notes never go in this PDF.
      patientRef.collection('clinicReadings')
        .select('measuredOn', 'weightKg', 'bpSys', 'bpDia', 'fundalHeightCm', 'fetalHeartRate', 'pulse', 'temperatureC', 'enteredByName')
        .get(),
      admin ? reportActor(admin) : Promise.resolve(doctor!.doctorName),
    ]);

    const report = buildPatientDetailReport({
      profile: {
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        clinicName: user.clinicName,
        dueDate: user.dueDate,
        firstTimeMom: user.firstTimeMom,
      },
      appointments: appts.docs.map((d) => ({
        date: String(d.get('date') ?? ''),
        time: String(d.get('time') ?? ''),
        label: String(d.get('label') ?? ''),
        type: String(d.get('type') ?? ''),
        doctor: String(d.get('doctor') ?? ''),
        status: String(d.get('status') ?? ''),
        doctorApproval: String(d.get('doctorApproval') ?? 'pending'),
      })),
      snapshots: snaps.docs.map((d) => ({
        createdAt: d.get('createdAt')?.toDate?.().toISOString() ?? null,
        type: String(d.get('type') ?? ''),
        week: typeof d.get('week') === 'number' ? d.get('week') : null,
        caption: String(d.get('caption') ?? ''),
        health: d.get('healthSnapshot') ?? null,
      })),
      clinicReadings: readings.docs.map((d) => d.data()).map((x) => ({
        measuredOn: x.measuredOn,
        weightKg: x.weightKg,
        bpSys: x.bpSys,
        bpDia: x.bpDia,
        fundalHeightCm: x.fundalHeightCm,
        fetalHeartRate: x.fetalHeartRate,
        pulse: x.pulse,
        temperatureC: x.temperatureC,
        enteredByName: x.enteredByName,
      })),
      range,
      now: new Date(),
    });

    await logAuditEvent({
      actorUid: admin ? admin.uid : doctor!.uid,
      actorEmail: admin ? (admin.email ?? 'unknown') : (doctor!.email ?? doctor!.doctorName),
      actorRole: admin ? 'admin' : 'doctor',
      action: 'report.patient_export',
      targetType: 'user',
      targetId: uid,
      targetLabel: user.fullName,
      details: null,
    });

    return NextResponse.json({ generatedBy, generatorRole: admin ? 'Admin' : 'Doctor', report });
  } catch (err: unknown) {
    console.error('Failed to build patient report:', (err as { code?: unknown })?.code ?? (err as Error)?.message ?? 'unknown');
    return NextResponse.json({ error: 'Could not build the report. Please try again.' }, { status: 500 });
  }
}
