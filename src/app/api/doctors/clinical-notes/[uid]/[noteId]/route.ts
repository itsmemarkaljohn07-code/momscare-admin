import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getDoctorSession } from '@/lib/get-doctor-session';
import { logAuditEvent } from '@/lib/audit-log';
import { patientName } from '@/lib/patient-name';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string; noteId: string }> }
) {
  const session = await getDoctorSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const { uid, noteId } = await params;

  try {
    const noteRef = adminDb.collection('users').doc(uid).collection('clinicalNotes').doc(noteId);
    const noteSnap = await noteRef.get();
    if (!noteSnap.exists) {
      return NextResponse.json({ error: 'Note not found.' }, { status: 404 });
    }
    const noteData = noteSnap.data()!;

    // Ownership is checked against what's actually stored, never
    // trusted from the request — a doctor can only delete their own
    // note, not another doctor's, even one on the same patient.
    if (noteData.authorUid !== session.uid) {
      return NextResponse.json({ error: 'You can only delete your own notes.' }, { status: 403 });
    }

    await noteRef.delete();

    const patientDoc = await adminDb.collection('users').doc(uid).get();

    await logAuditEvent({
      actorUid: session.uid,
      actorEmail: session.doctorName,
      actorRole: 'doctor',
      action: 'clinical_note.delete',
      targetType: 'user',
      targetId: uid,
      targetLabel: patientName(patientDoc.data(), uid),
      details: null,
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Failed to delete clinical note:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}