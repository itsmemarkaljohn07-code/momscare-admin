import { adminDb } from '@/lib/firebase-admin';
import { withRetry } from '@/lib/with-retry';
import { Timestamp } from 'firebase-admin/firestore';

export interface AuditLogView {
  id: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  targetLabel: string;
  details: string | null;
  createdAt: string | null;
}

export interface AuditLogFilters {
  /** Matches actor email or target label (case-insensitive). */
  q?: string;
  /** Exact action key, e.g. 'doctor.update'. */
  action?: string;
  role?: 'admin' | 'doctor' | 'patient';
  /** Manila calendar days, YYYY-MM-DD, inclusive. */
  from?: string;
  to?: string;
}

export interface AuditLogPage {
  entries: AuditLogView[];
  /** Pass back to get the next page; null when there is nothing older. */
  cursor: string | null;
}

export const AUDIT_PAGE_SIZE = 25;
/** Most entries read per page while action/role/search filters skip
 *  non-matching ones; the next "Load more" continues from there. */
const MAX_SCAN = 400;
const SCAN_CHUNK = 100;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function toView(id: string, data: FirebaseFirestore.DocumentData): AuditLogView {
  return {
    id,
    // Minimal entries (logMinimalAuditEvent) carry no email or target,
    // so fall back to the actor's uid and a dash.
    actorEmail: data.actorEmail ?? data.actorUid ?? '—',
    actorRole: data.actorRole ?? '',
    action: data.action ?? '',
    targetType: data.targetType ?? '',
    targetId: data.targetId ?? '',
    targetLabel: data.targetLabel ?? '—',
    details: data.details ?? null,
    createdAt: data.createdAt?.toDate?.().toISOString() ?? null,
  };
}

/** Start of a Manila (UTC+8, no DST) calendar day. */
function manilaDayStart(day: string): Timestamp {
  return Timestamp.fromDate(new Date(`${day}T00:00:00+08:00`));
}

function matches(v: AuditLogView, f: AuditLogFilters): boolean {
  if (f.action && v.action !== f.action) return false;
  if (f.role && v.actorRole !== f.role) return false;
  const q = f.q?.trim().toLowerCase();
  if (q && !v.actorEmail.toLowerCase().includes(q) && !v.targetLabel.toLowerCase().includes(q)) return false;
  return true;
}

/**
 * One page of the audit log, newest first, read-only.
 *
 * Firestore does the ordering, the date range and the paging (createdAt
 * desc + startAfter the last document read): all on the automatic
 * single-field index. Filtering by action or role while ordering by date
 * would need a composite index, so those and the search are applied here
 * while reading, at most MAX_SCAN entries per page; the cursor then
 * continues where the scan stopped.
 */
export async function getAuditLogPage(filters: AuditLogFilters = {}, cursor: string | null = null): Promise<AuditLogPage> {
  const col = adminDb.collection('auditLogs');
  let base = col.orderBy('createdAt', 'desc');
  if (filters.from && DAY_PATTERN.test(filters.from)) base = base.where('createdAt', '>=', manilaDayStart(filters.from));
  if (filters.to && DAY_PATTERN.test(filters.to)) {
    const next = new Date(`${filters.to}T00:00:00+08:00`);
    next.setUTCDate(next.getUTCDate() + 1);
    base = base.where('createdAt', '<', Timestamp.fromDate(next));
  }

  let after: FirebaseFirestore.DocumentSnapshot | null = null;
  if (cursor) {
    const snap = await col.doc(cursor).get();
    if (snap.exists) after = snap;
  }

  const entries: AuditLogView[] = [];
  let scanned = 0;
  let lastId: string | null = null;
  let exhausted = false;

  while (entries.length < AUDIT_PAGE_SIZE && scanned < MAX_SCAN) {
    let q = base.limit(SCAN_CHUNK);
    if (after) q = q.startAfter(after);
    const snap = await withRetry(() => q.get());
    let readAll = true;
    for (const [i, doc] of snap.docs.entries()) {
      scanned++;
      lastId = doc.id;
      after = doc;
      const view = toView(doc.id, doc.data());
      if (matches(view, filters)) entries.push(view);
      if (entries.length === AUDIT_PAGE_SIZE) {
        readAll = i === snap.size - 1;
        break;
      }
    }
    // A short chunk read to its end means there is nothing older.
    if (snap.size < SCAN_CHUNK && readAll) {
      exhausted = true;
      break;
    }
  }

  // Patient entries carry only the uid: show the patient's name instead
  // (one read for the patients on this page).
  const patientUids = [...new Set(entries.filter((e) => e.actorRole === 'patient').map((e) => e.actorEmail))];
  if (patientUids.length > 0) {
    const docs = await adminDb.getAll(...patientUids.map((uid) => adminDb.collection('users').doc(uid)), { fieldMask: ['fullName'] });
    const names = new Map(docs.map((d) => [d.id, String(d.get('fullName') ?? '').trim()]));
    for (const e of entries) {
      if (e.actorRole === 'patient') e.actorEmail = names.get(e.actorEmail) || 'Deleted patient';
    }
  }

  return { entries, cursor: exhausted ? null : lastId };
}
