import { NextResponse } from 'next/server';
import type { DocumentData } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { getDoctorSession, type DoctorSession } from '@/lib/get-doctor-session';
import { isNonPatientUid } from '@/lib/patient-deletion';
import { logAuditEvent } from '@/lib/audit-log';
import { patientName } from '@/lib/patient-name';
import type { ClinicReading } from '@/lib/clinic-readings';

// Firestore side of clinic readings: users/{uid}/clinicReadings/{id},
// written only by the server (Admin SDK) for the patient's assigned doctor.

export const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export const readingsCol = (uid: string) => adminDb.collection('users').doc(uid).collection('clinicReadings');

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function readingFromDoc(id: string, d: DocumentData): ClinicReading & { id: string } {
  return {
    id,
    weightKg: num(d.weightKg),
    bpSys: num(d.bpSys),
    bpDia: num(d.bpDia),
    // Later fields: older documents do not have them.
    fundalHeightCm: num(d.fundalHeightCm),
    fetalHeartRate: num(d.fetalHeartRate),
    pulse: num(d.pulse),
    temperatureC: num(d.temperatureC),
    note: typeof d.note === 'string' ? d.note : '',
    measuredOn: typeof d.measuredOn === 'string' ? d.measuredOn : '',
    enteredByUid: typeof d.enteredByUid === 'string' ? d.enteredByUid : '',
    enteredByName: typeof d.enteredByName === 'string' ? d.enteredByName : '',
    enteredAt: d.enteredAt?.toMillis?.() ?? 0,
    updatedAt: d.updatedAt?.toMillis?.() ?? 0,
  };
}

/**
 * A doctor session and a real patient assigned to that doctor (the same
 * check as the clinical-notes routes: the patient's assignedDoctorNames),
 * or the error response to return. No doctor session (an admin's included)
 * gives 401, a patient of another doctor 403.
 */
export async function readingAccess(uid: string): Promise<{ session: DoctorSession; name: string } | NextResponse> {
  const session = await getDoctorSession();
  if (!session) return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  if (!ID_PATTERN.test(uid)) return NextResponse.json({ error: 'Patient not found.' }, { status: 404 });
  const [snap, staff] = await Promise.all([adminDb.collection('users').doc(uid).get(), isNonPatientUid(uid)]);
  if (!snap.exists || staff) return NextResponse.json({ error: 'Patient not found.' }, { status: 404 });
  const assigned: unknown = snap.get('assignedDoctorNames');
  if (!Array.isArray(assigned) || !assigned.includes(session.doctorName)) {
    return NextResponse.json({ error: 'Not your patient.' }, { status: 403 });
  }
  return { session, name: patientName(snap.data(), 'Patient') };
}

const DETAILS = { create: 'Health reading added', update: 'Health reading changed', delete: 'Health reading deleted' } as const;

/** One audit entry per change; the text never holds values or dates. */
export function auditReading(session: DoctorSession, uid: string, name: string, action: keyof typeof DETAILS) {
  return logAuditEvent({
    actorUid: session.uid,
    actorEmail: session.email ?? session.doctorName,
    actorRole: 'doctor',
    action: `clinic_reading.${action}`,
    targetType: 'user',
    targetId: uid,
    targetLabel: name,
    details: DETAILS[action],
  });
}

/** The body as JSON, or null when it is not valid JSON. */
export async function jsonBody(req: Request): Promise<unknown | null> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
