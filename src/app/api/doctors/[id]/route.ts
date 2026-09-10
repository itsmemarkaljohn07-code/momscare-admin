import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getAdminSession } from '@/lib/get-admin-session';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const { id } = await params;
  const { name, specialty, workingDays, startTime, endTime, slotMinutes } = await req.json();

  if (!name || !specialty || !Array.isArray(workingDays) || workingDays.length === 0 || !startTime || !endTime || !slotMinutes) {
    return NextResponse.json({ error: 'Please complete all required fields.' }, { status: 400 });
  }

  try {
    await adminDb.collection('doctors').doc(id).update({
      name, specialty, workingDays, startTime, endTime, slotMinutes: Number(slotMinutes),
    });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Failed to update doctor:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    await adminDb.collection('doctors').doc(id).delete();
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Failed to delete doctor:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}