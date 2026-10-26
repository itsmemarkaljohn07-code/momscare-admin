import { Timestamp, type DocumentData } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { NextResponse } from 'next/server';
import { getAdminSession, type AdminSession } from '@/lib/get-admin-session';
import { isNonPatientUid } from '@/lib/patient-deletion';
import { logAuditEvent } from '@/lib/audit-log';
import type { Stay } from '@/lib/stays';
import { patientName } from '@/lib/patient-name';

// Firestore side of birth stays: users/{uid}/stays/{id}, written only by
// the server (Admin SDK); clients stay denied by the default rule.

export const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export const staysCol = (uid: string) => adminDb.collection('users').doc(uid).collection('stays');

const ms = (v: unknown): number | null => (v instanceof Timestamp ? v.toMillis() : null);
const ts = (v: number | null) => (v === null ? null : Timestamp.fromMillis(v));

export function docToStay(d: DocumentData): Stay {
  return {
    admittedAt: ms(d.admittedAt) ?? 0,
    deliveredAt: ms(d.deliveredAt),
    outcome: d.outcome === 'live' || d.outcome === 'stillbirth' ? d.outcome : null,
    babySex: d.babySex === 'male' || d.babySex === 'female' ? d.babySex : null,
    birthWeightG: typeof d.birthWeightG === 'number' ? d.birthWeightG : null,
    birthLengthCm: typeof d.birthLengthCm === 'number' ? d.birthLengthCm : null,
    dischargedAt: ms(d.dischargedAt),
    transferredAt: ms(d.transferredAt),
  };
}

export function stayToDoc(s: Stay): DocumentData {
  return {
    admittedAt: ts(s.admittedAt),
    deliveredAt: ts(s.deliveredAt),
    outcome: s.outcome,
    babySex: s.babySex,
    birthWeightG: s.birthWeightG,
    birthLengthCm: s.birthLengthCm,
    dischargedAt: ts(s.dischargedAt),
    transferredAt: ts(s.transferredAt),
  };
}

/** Admin session and a real patient, or the error response to return. */
export async function stayAccess(uid: string): Promise<{ session: AdminSession; name: string } | NextResponse> {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  if (!ID_PATTERN.test(uid)) return NextResponse.json({ error: 'Patient not found.' }, { status: 404 });
  const [snap, staff] = await Promise.all([adminDb.collection('users').doc(uid).get(), isNonPatientUid(uid)]);
  if (!snap.exists || staff) return NextResponse.json({ error: 'Patient not found.' }, { status: 404 });
  return { session, name: patientName(snap.data(), 'Patient') };
}

/** One audit entry per change; its text never holds clinical values or dates. */
export function auditStay(session: AdminSession, uid: string, name: string, action: 'create' | 'update' | 'delete') {
  return logAuditEvent({
    actorUid: session.uid,
    actorEmail: session.email ?? 'unknown',
    actorRole: 'admin',
    action: `stay.${action}`,
    targetType: 'user',
    targetId: uid,
    targetLabel: name,
    details: action === 'create' ? 'Birth stay added' : action === 'update' ? 'Birth stay changed' : 'Birth stay deleted',
  });
}
