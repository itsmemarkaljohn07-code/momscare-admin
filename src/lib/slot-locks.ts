import { FieldValue, Timestamp, type DocumentReference, type Transaction } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';

// One lock document per booked doctor slot: doctorSlots/{doctorId}_{date}_{HH-mm}
// (see slotLockId). Only the server reads or writes them (Admin SDK), so no
// client rule exists for them and clients stay denied by default.
//
// The appointment holding a lock stores its id as `slotLockId`, and the
// lock stores the appointment's path. A lock is released only by the
// appointment it points to, and a lock whose appointment is gone or no
// longer upcoming (e.g. its patient was deleted), or that the doctor or
// clinic declined, counts as free.
//
// All helpers work inside a transaction: call the read* helpers before any
// write, as Firestore requires.

export const SLOT_TAKEN_MESSAGE = 'That time was just booked';

export function slotLockRef(lockId: string): DocumentReference {
  return adminDb.collection('doctorSlots').doc(lockId);
}

/** Reads a lock and, if it has one, its appointment. `free` is true when
 *  no live upcoming appointment holds the slot. */
export async function readSlotLock(
  tx: Transaction,
  lockId: string
): Promise<{ ref: DocumentReference; free: boolean }> {
  const ref = slotLockRef(lockId);
  const lock = await tx.get(ref);
  if (!lock.exists) return { ref, free: true };
  const path = lock.get('appointmentPath');
  if (typeof path !== 'string' || !path) return { ref, free: true };
  const holder = await tx.get(adminDb.doc(path));
  const held =
    holder.exists &&
    holder.get('status') === 'upcoming' &&
    holder.get('doctorApproval') !== 'rejected' &&
    holder.get('slotLockId') === lockId;
  return { ref, free: !held };
}

/** Takes a free lock for an appointment (write; call after the reads). */
export function writeSlotLock(
  tx: Transaction,
  ref: DocumentReference,
  appointment: DocumentReference,
  slot: { doctorId: string; date: string; time: string }
): void {
  tx.set(ref, { ...slot, appointmentPath: appointment.path, createdAt: Timestamp.now() });
}

/** The appointment's own lock, if it still points to this appointment. */
export async function readOwnedSlotLock(
  tx: Transaction,
  appointment: DocumentReference,
  data: FirebaseFirestore.DocumentData
): Promise<DocumentReference | null> {
  const lockId = data.slotLockId;
  if (typeof lockId !== 'string' || !lockId) return null;
  const ref = slotLockRef(lockId);
  const lock = await tx.get(ref);
  return lock.exists && lock.get('appointmentPath') === appointment.path ? ref : null;
}

/** Releases the appointment's lock (write). Returns the field update that
 *  clears `slotLockId` on the appointment, to merge into its own update. */
export function releaseSlotLock(tx: Transaction, owned: DocumentReference | null): Record<string, unknown> {
  if (owned) tx.delete(owned);
  return { slotLockId: FieldValue.delete() };
}
