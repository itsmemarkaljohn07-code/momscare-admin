import { adminDb } from '@/lib/firebase-admin';
import { withRetry } from '@/lib/with-retry';

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

export async function getAuditLogs(limitCount = 300): Promise<AuditLogView[]> {
  const snapshot = await withRetry(() =>
    adminDb.collection('auditLogs').orderBy('createdAt', 'desc').limit(limitCount).get()
  );
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      actorEmail: data.actorEmail,
      actorRole: data.actorRole,
      action: data.action,
      targetType: data.targetType,
      targetId: data.targetId,
      targetLabel: data.targetLabel,
      details: data.details ?? null,
      createdAt: data.createdAt?.toDate?.().toISOString() ?? null,
    };
  });
}