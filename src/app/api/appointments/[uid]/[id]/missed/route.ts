import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/get-admin-session';
import { getDoctorSession } from '@/lib/get-doctor-session';
import { markAppointmentMissed } from '@/lib/mark-missed';

/**
 * Marks one appointment missed when an admin or doctor has a page open
 * (useMarkMissed). The scheduled sweep (/api/cron/sweep) does the same
 * through markAppointmentMissed, so it also happens with nobody signed in.
 * A doctor may only mark appointments assigned to them.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ uid: string; id: string }> }
) {
  const admin = await getAdminSession();
  const doctor = admin ? null : await getDoctorSession();
  if (!admin && !doctor) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const { uid, id } = await params;

  try {
    const outcome = await markAppointmentMissed(uid, id, doctor ? { doctorName: doctor.doctorName ?? '' } : {});

    if (outcome === 'not_found') {
      return NextResponse.json({ error: 'Appointment not found.' }, { status: 404 });
    }
    if (outcome === 'forbidden') {
      return NextResponse.json({ error: 'Not your appointment.' }, { status: 403 });
    }
    return NextResponse.json({ success: true, changed: outcome === 'marked' });
  } catch (err: unknown) {
    console.error('Failed to mark appointment as missed:', err);
    return NextResponse.json({ error: 'Could not mark the appointment as missed.' }, { status: 500 });
  }
}
