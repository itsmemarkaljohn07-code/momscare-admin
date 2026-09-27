import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getDoctorSession } from '@/lib/get-doctor-session';
import { logAuditEvent } from '@/lib/audit-log';
import { Timestamp } from 'firebase-admin/firestore';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const session = await getDoctorSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const { uid } = await params;
  const { message } = await req.json();

  if (!message || !message.trim()) {
    return NextResponse.json({ error: 'Note cannot be empty.' }, { status: 400 });
  }

  try {
    const patientDoc = await adminDb.collection('users').doc(uid).get();
    if (!patientDoc.exists) {
      return NextResponse.json({ error: 'Patient not found.' }, { status: 404 });
    }
    const assigned: string[] = patientDoc.data()?.assignedDoctorNames ?? [];
    if (!assigned.includes(session.doctorName)) {
      return NextResponse.json({ error: 'Not your patient.' }, { status: 403 });
    }

    const trimmedMessage = message.trim();
    const now = Timestamp.now();

    const noteRef = await adminDb.collection('users').doc(uid).collection('clinicalNotes').add({
      authorUid: session.uid,
      authorName: session.doctorName,
      message: trimmedMessage,
      createdAt: now,
    });

    await logAuditEvent({
      actorUid: session.uid,
      actorEmail: session.doctorName,
      actorRole: 'doctor',
      action: 'clinical_note.create',
      targetType: 'user',
      targetId: uid,
      targetLabel: patientDoc.data()?.fullName ?? uid,
      details: trimmedMessage.length > 120 ? `${trimmedMessage.slice(0, 120)}…` : trimmedMessage,
    });

    return NextResponse.json({ success: true, id: noteRef.id });
  } catch (err: unknown) {
    console.error('Failed to create clinical note:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}