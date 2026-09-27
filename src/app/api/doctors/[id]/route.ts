import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getAdminSession } from '@/lib/get-admin-session';
import { Timestamp } from 'firebase-admin/firestore';
import { logAuditEvent } from '@/lib/audit-log';

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const { name, specialty, workingDays, startTime, endTime, slotMinutes } = await req.json();

  if (!name || !specialty || !Array.isArray(workingDays) || workingDays.length === 0 || !startTime || !endTime || !slotMinutes) {
    return NextResponse.json({ error: 'Please complete all required fields.' }, { status: 400 });
  }

  try {
    const docRef = await adminDb.collection('doctors').add({
      name, specialty, workingDays, startTime, endTime,
      slotMinutes: Number(slotMinutes),
      createdAt: Timestamp.now(),
    });

    await logAuditEvent({
      actorUid: session.uid,
      actorEmail: session.email ?? 'unknown',
      actorRole: 'admin',
      action: 'doctor.create',
      targetType: 'doctor',
      targetId: docRef.id,
      targetLabel: name,
      details: null,
    });

    return NextResponse.json({ success: true, id: docRef.id });
  } catch (err: unknown) {
    console.error('Failed to create doctor:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}