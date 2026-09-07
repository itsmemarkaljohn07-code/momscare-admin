import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getAdminSession } from '@/lib/get-admin-session';
import { Timestamp } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const body = await req.json();
  const { patientUid, ...appt } = body;

  if (!patientUid) {
    return NextResponse.json({ error: 'A patient must be selected.' }, { status: 400 });
  }

  try {
    const docRef = await adminDb
      .collection('users')
      .doc(patientUid)
      .collection('appointments')
      .add({
        ...appt,
        userId: patientUid,
        status: 'upcoming',
        createdAt: Timestamp.now(),
      });

    return NextResponse.json({ success: true, id: docRef.id });
  } catch (err: unknown) {
    console.error('Failed to create appointment:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}