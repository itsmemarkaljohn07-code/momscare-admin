import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getAdminSession } from '@/lib/get-admin-session';
import { Timestamp } from 'firebase-admin/firestore';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string; id: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const { uid, id } = await params;
  const body = await req.json();

  try {
    await adminDb
      .collection('users')
      .doc(uid)
      .collection('appointments')
      .doc(id)
      .update({ ...body, updatedAt: Timestamp.now() });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Failed to update appointment:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string; id: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const { uid, id } = await params;

  try {
    const docRef = adminDb.collection('users').doc(uid).collection('appointments').doc(id);
    const snap = await docRef.get();

    if (!snap.exists) {
      return NextResponse.json({ error: 'Appointment not found.' }, { status: 404 });
    }

    const status = snap.data()?.status;
    if (status !== 'completed' && status !== 'cancelled') {
      return NextResponse.json(
        { error: 'Only completed or cancelled appointments can be deleted.' },
        { status: 400 }
      );
    }

    await docRef.delete();
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Failed to delete appointment:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}