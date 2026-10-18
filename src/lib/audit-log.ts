import { adminDb } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import type { PatientAuditEvent } from '@/lib/patient-audit-rules';

export type AuditActorRole = 'admin' | 'doctor' | 'patient';

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
/**
 * Records patient actions taken in the app (see patient-audit-rules.ts).
 * Each event has a fixed document id and is written with create(), so
 * running this again never duplicates an entry. No email and no free
 * text: actorUid is the patient's uid, the label holds type + date/time.
 * With dryRun it only counts the missing ones. Never throws.
 */
export async function logPatientAuditEvents(
  events: PatientAuditEvent[],
  { dryRun }: { dryRun: boolean }
): Promise<{ found: number; missing: number; created: number }> {
  const result = { found: events.length, missing: 0, created: 0 };
  try {
    const col = adminDb.collection('auditLogs');
    for (let i = 0; i < events.length; i += 100) {
      const chunk = events.slice(i, i + 100);
      const snaps = await adminDb.getAll(...chunk.map((e) => col.doc(e.id)), { fieldMask: [] });
      const existing = new Set(snaps.filter((s) => s.exists).map((s) => s.id));
      for (const e of chunk) {
        if (existing.has(e.id)) continue;
        result.missing++;
        if (dryRun) continue;
        try {
          await col.doc(e.id).create({
            actorUid: e.actorUid,
            actorRole: 'patient',
            action: e.action,
            targetType: e.targetType,
            targetId: e.targetId,
            targetLabel: e.targetLabel,
            details: null,
            createdAt: Timestamp.fromMillis(e.at),
          });
          result.created++;
        } catch (err) {
          const code = (err as { code?: unknown })?.code;
          if (code !== 6 && code !== 409 && code !== 'already-exists') throw err;
        }
      }
    }
  } catch (err) {
    console.error('[audit-log] patient entries failed (non-fatal):', (err as { code?: unknown })?.code ?? 'unknown');
  }
  return result;
}
