import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getDoctorSession } from '@/lib/get-doctor-session';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string; id: string }> }
) {
  const session = await getDoctorSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const { uid, id } = await params;
  const { doctorApproval, rejectionReason } = await req.json();

  if (!['approved', 'rejected'].includes(doctorApproval)) {
    return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
  }

  try {
    const docRef = adminDb.collection('users').doc(uid).collection('appointments').doc(id);
    const snap = await docRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Appointment not found.' }, { status: 404 });
    }
    // Security: a doctor can only act on appointments actually
    // assigned to them — verified against the doctor field stored on
    // the appointment itself, not just trusted from the request.
    const storedDoctor = (snap.data()?.doctor ?? '').trim().toLowerCase();
    const sessionDoctor = (session.doctorName ?? '').trim().toLowerCase();
    if (!storedDoctor || storedDoctor !== sessionDoctor) {
      return NextResponse.json({ error: 'Not your appointment.' }, { status: 403 });
    }

    await docRef.update({
      doctorApproval,
      rejectionReason: doctorApproval === 'rejected' ? (rejectionReason ?? '') : null,
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Failed to update appointment approval:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}