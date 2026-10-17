import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getAdminSession } from '@/lib/get-admin-session';
import { Timestamp } from 'firebase-admin/firestore';
import { logAuditEvent } from '@/lib/audit-log';
import { isAccentColor, isIcon } from '@/lib/appointment-requests';
import { daySlots, minutesToHHmm, slotLockId, timeToMinutes } from '@/lib/doctor-availability';
import { getAvailableSlots, getDoctorForSlotsByName } from '@/lib/doctor-slots';
import {
  readOwnedSlotLock, readSlotLock, releaseSlotLock, SLOT_TAKEN_MESSAGE, writeSlotLock,
} from '@/lib/slot-locks';

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
  // The form no longer edits the card's icon and colour; an edit may only
  // set a valid one, never clear or break the one already stored.
  if (!isIcon(body.icon)) delete body.icon;
  if (!isAccentColor(body.accentColor)) delete body.accentColor;

  try {
    const docRef = adminDb.collection('users').doc(uid).collection('appointments').doc(id);

    // An edit that moves the appointment (doctor, date or time) needs the
    // new slot: free, on the doctor's schedule, and locked like a booking.
    let move: { lockId: string; slot: { doctorId: string; date: string; time: string }; doctorName: string } | null = null;
    const current = (await docRef.get()).data();
    if (current && ('doctor' in body || 'date' in body || 'time' in body)) {
      const doctorName = String(body.doctor ?? current.doctor ?? '');
      const date = String(body.date ?? current.date ?? '');
      const minutes = timeToMinutes(String(body.time ?? current.time ?? ''));
      const moved =
        doctorName.trim() !== String(current.doctor ?? '').trim() ||
        date !== current.date ||
        minutes !== timeToMinutes(String(current.time ?? ''));
      if (moved) {
        const doctor = await getDoctorForSlotsByName(doctorName);
        if (!doctor) return NextResponse.json({ error: 'Choose a doctor from the list.' }, { status: 400 });
        if (minutes === null || !(daySlots(doctor.schedule) ?? []).includes(minutes)) {
          return NextResponse.json({ error: "That time isn't one of the doctor's appointment times." }, { status: 400 });
        }
        const hhmm = minutesToHHmm(minutes);
        const free = await getAvailableSlots(doctor, date, null, { patientUid: uid, id });
        if (!free.slots.includes(hhmm)) {
          return NextResponse.json(
            { error: free.reason === 'not_working_day' ? "The doctor doesn't work on that day." : SLOT_TAKEN_MESSAGE },
            { status: free.reason === 'not_working_day' ? 400 : 409 }
          );
        }
        move = { lockId: slotLockId(doctor.id, date, hhmm), slot: { doctorId: doctor.id, date, time: hhmm }, doctorName: doctor.name };
      }
    }
    const releases = body.status === 'completed' || body.status === 'cancelled';

    // Read and write in one transaction so a change made a moment ago
    // (cancelled, completed or marked missed by someone else) can't be
    // overwritten. Only an upcoming appointment can be edited, completed
    // or cancelled. beforeData describes the appointment in the audit log
    // even if the edit itself changes its label/date/time.
    const outcome = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(docRef);
      if (!snap.exists) return { kind: 'not_found' as const };
      const beforeData = snap.data() ?? {};
      if (beforeData.status !== 'upcoming') return { kind: 'closed' as const };

      // Reads first (Firestore transaction rule), then writes.
      const owned = releases || move ? await readOwnedSlotLock(tx, docRef, beforeData) : null;
      const target = move && move.lockId !== beforeData.slotLockId ? await readSlotLock(tx, move.lockId) : null;
      if (target && !target.free) return { kind: 'taken' as const };

      let slotFields: Record<string, unknown> = {};
      if (releases) {
        // Completed or cancelled: the doctor's slot is free again.
        slotFields = releaseSlotLock(tx, owned);
      } else if (move && target) {
        if (owned) tx.delete(owned);
        writeSlotLock(tx, target.ref, docRef, move.slot);
        slotFields = { slotLockId: move.lockId, doctor: move.doctorName };
      }
      tx.update(docRef, { ...body, ...slotFields, updatedAt: Timestamp.now() });
      return { kind: 'saved' as const, beforeData };
    });

    if (outcome.kind === 'not_found') {
      return NextResponse.json({ error: 'Appointment not found.' }, { status: 404 });
    }
    if (outcome.kind === 'closed') {
      return NextResponse.json(
        { error: "This appointment is already missed, cancelled or completed and can't be changed." },
        { status: 409 }
      );
    }
    if (outcome.kind === 'taken') {
      return NextResponse.json({ error: SLOT_TAKEN_MESSAGE }, { status: 409 });
    }
    const { beforeData } = outcome;

    const isStatusOnly = 'status' in body && Object.keys(body).length === 1;

    await logAuditEvent({
      actorUid: session.uid,
      actorEmail: session.email ?? 'unknown',
      actorRole: 'admin',
      action: isStatusOnly ? 'appointment.status_change' : 'appointment.edit',
      targetType: 'appointment',
      targetId: id,
      targetLabel: `${beforeData.label ?? 'Appointment'} — ${beforeData.date ?? ''} ${beforeData.time ?? ''}`.trim(),
      details: isStatusOnly ? `Status changed to ${body.status}` : null,
    });

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

    const data = snap.data() ?? {};
    const status = data.status;
    if (status !== 'completed' && status !== 'cancelled') {
      return NextResponse.json(
        { error: 'Only completed or cancelled appointments can be deleted.' },
        { status: 400 }
      );
    }

    // Delete it together with any slot lock still pointing to it.
    await adminDb.runTransaction(async (tx) => {
      const fresh = await tx.get(docRef);
      if (!fresh.exists) return;
      const owned = await readOwnedSlotLock(tx, docRef, fresh.data() ?? {});
      if (owned) tx.delete(owned);
      tx.delete(docRef);
    });

    await logAuditEvent({
      actorUid: session.uid,
      actorEmail: session.email ?? 'unknown',
      actorRole: 'admin',
      action: 'appointment.delete',
      targetType: 'appointment',
      targetId: id,
      targetLabel: `${data.label ?? 'Appointment'} — ${data.date ?? ''}`.trim(),
      details: null,
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Failed to delete appointment:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}