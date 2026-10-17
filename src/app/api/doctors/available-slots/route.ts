import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getAdminSession } from '@/lib/get-admin-session';
import { getAvailableSlots, getDoctorForSlots } from '@/lib/doctor-slots';
import type { PreferredWindow } from '@/lib/doctor-availability';

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Admin only. GET ?doctorId&date[&patientUid&requestId]: the doctor's free
 * slots ("HH:mm") on that date; with a request, only those inside the
 * patient's preferred windows. An empty list comes with a reason:
 * no_schedule | not_working_day | fully_booked | no_overlap.
 */
export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const p = req.nextUrl.searchParams;
  const doctorId = p.get('doctorId') ?? '';
  const date = p.get('date') ?? '';
  const patientUid = p.get('patientUid');
  const requestId = p.get('requestId');
  if (
    !ID_PATTERN.test(doctorId) || !DAY_PATTERN.test(date) ||
    (requestId !== null && (!patientUid || !ID_PATTERN.test(patientUid) || !ID_PATTERN.test(requestId)))
  ) {
    return NextResponse.json({ error: 'A doctor and a date (yyyy-MM-dd) are required.' }, { status: 400 });
  }

  try {
    const doctor = await getDoctorForSlots(doctorId);
    if (!doctor) return NextResponse.json({ error: 'Doctor not found.' }, { status: 404 });

    let windows: PreferredWindow[] | null = null;
    if (requestId && patientUid) {
      const request = await adminDb.collection('users').doc(patientUid).collection('appointmentRequests').doc(requestId).get();
      if (!request.exists) return NextResponse.json({ error: 'Request not found.' }, { status: 404 });
      const options = request.get('options');
      windows = Array.isArray(options) ? options : [];
    }

    return NextResponse.json(await getAvailableSlots(doctor, date, windows));
  } catch (err: unknown) {
    console.error('Failed to load available slots:', (err as { code?: unknown })?.code ?? 'unknown');
    return NextResponse.json({ error: 'Could not load available times.' }, { status: 500 });
  }
}
