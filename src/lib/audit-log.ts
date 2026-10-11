import { adminDb } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

export type AuditActorRole = 'admin' | 'doctor';

export interface AuditLogEntry {
  actorUid: string;
  actorEmail: string;
  actorRole: AuditActorRole;
  /** Short, machine-readable key, e.g. 'doctor.create_account'. Kept
   *  as a stable string rather than an enum so new action types can be
   *  added anywhere without touching a shared type definition. */
  action: string;
  targetType: string; // 'doctor' | 'user' | 'admin' | 'appointment' | ...
  targetId: string;
  targetLabel: string; // human-readable — a name, not just an id
  details?: string | null;
}

/**
 * Records an audit trail entry. Deliberately best-effort: failures
 * are caught and logged to the console, never thrown. The action
 * being audited has already happened by the time this is called —
 * a logging failure should never roll back or block it.
 */
export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  try {
    await adminDb.collection('auditLogs').add({
      ...entry,
      details: entry.details ?? null,
      createdAt: Timestamp.now(),
    });
  } catch (err) {
    console.error('[audit-log] Failed to record audit event (non-fatal):', err);
  }
}

export interface MinimalAuditLogEntry {
  actorUid: string;
  actorRole: AuditActorRole;
  action: string;
}

/**
 * Records an audit entry that carries no personal data: just the
 * action, the date and the acting user's uid — no email, no target
 * name or id. Used where the subject's data has been erased. Same
 * best-effort contract as logAuditEvent, but reports whether the write
 * succeeded so the caller can surface it.
 */
export async function logMinimalAuditEvent(entry: MinimalAuditLogEntry): Promise<boolean> {
  try {
    await adminDb.collection('auditLogs').add({
      ...entry,
      createdAt: Timestamp.now(),
    });
    return true;
  } catch (err) {
    console.error('[audit-log] Failed to record audit event (non-fatal):', err);
    return false;
  }
}