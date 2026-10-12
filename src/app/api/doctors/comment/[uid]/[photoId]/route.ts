import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getDoctorSession } from '@/lib/get-doctor-session';
import { Timestamp } from 'firebase-admin/firestore';
import { notifyPatient } from '@/lib/notify-patient';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string; photoId: string }> }
) {
  const session = await getDoctorSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const { uid, photoId } = await params;
  const { message } = await req.json();

  if (!message || !message.trim()) {
    return NextResponse.json({ error: 'Comment cannot be empty.' }, { status: 400 });
  }

  try {
    // Same authorization the old client-side Firestore rule enforced
    // (assignedDoctorNames) — has to be re-checked explicitly here,
    // since writing via the Admin SDK bypasses rules entirely.
    const patientDoc = await adminDb.collection('users').doc(uid).get();
    if (!patientDoc.exists) {
      return NextResponse.json({ error: 'Patient not found.' }, { status: 404 });
    }
    const assigned: string[] = patientDoc.data()?.assignedDoctorNames ?? [];
    if (!assigned.includes(session.doctorName)) {
      return NextResponse.json({ error: 'Not your patient.' }, { status: 403 });
    }

    // Optional author details shown alongside the comment. Only set
    // when non-empty — Firestore rejects undefined values.
    // Best-effort: a failed read just means the comment posts without them.
    const authorExtras: { authorSpecialty?: string; authorPhotoUrl?: string } = {};
    try {
      const doctorDoc = await adminDb.collection('doctors').doc(session.doctorId).get();
      const doctorData = doctorDoc.data();
      if (typeof doctorData?.specialty === 'string' && doctorData.specialty.trim()) {
        authorExtras.authorSpecialty = doctorData.specialty;
      }
      if (typeof doctorData?.photoUrl === 'string' && doctorData.photoUrl.trim()) {
        authorExtras.authorPhotoUrl = doctorData.photoUrl;
      }
    } catch (doctorErr) {
      console.error('Failed to read doctor profile for comment (non-fatal):', doctorErr);
    }

    const trimmedMessage = message.trim();
    const now = Timestamp.now();

    const commentRef = await adminDb
      .collection('users').doc(uid)
      .collection('snapshots').doc(photoId)
      .collection('comments').add({
        userId: uid,
        snapshotId: photoId,
        authorRole: 'doctor',
        authorName: session.doctorName,
        ...authorExtras,
        message: trimmedMessage,
        parentCommentId: null,
        createdAt: now,
      });

    // The comment above has already been saved; notifyPatient never
    // throws, so a notification failure never affects it. The push
    // carries no comment text.
    await notifyPatient({
      uid,
      type: 'doctor_comment',
      refId: photoId,
      route: '/snapshot',
      icon: '💬',
      bellTitle: 'New Comment',
      bellMessage: `${session.doctorName} commented on your photo.`,
      pushTitle: 'Your Doctor Left a Comment',
      pushBody: 'Mommy, your doctor has shared an update on your pregnancy Snapshot. Tap to view it.',
      id: `comment_${commentRef.id}`,
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Failed to post doctor comment:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}