import { adminDb } from '@/lib/firebase-admin';
import { getUsers } from '@/lib/get-users';

export interface SnapshotUserSummary {
  uid: string;
  fullName: string;
  email: string | null;
  photoCount: number;
  lastUploadAt: string | null;
}

/** Uses a collection-group query across every patient's own snapshots
 *  subcollection, then groups by parent UID — same pattern already
 *  used in get-appointments.ts for reading across all patients. */
export async function getSnapshotUsers(): Promise<SnapshotUserSummary[]> {
  const [snapshot, users] = await Promise.all([
    adminDb.collectionGroup('snapshots').get(),
    getUsers(),
  ]);

  const nameByUid = new Map(users.map((u) => [u.uid, u.fullName]));
  const emailByUid = new Map(users.map((u) => [u.uid, u.email]));

  const counts = new Map<string, { count: number; lastUploadAt: string | null }>();

  for (const doc of snapshot.docs) {
    const uid = doc.ref.parent.parent?.id;
    if (!uid) continue;
    const data = doc.data();
    const createdAt: string | null = data.createdAt?.toDate?.().toISOString() ?? null;

    const existing = counts.get(uid) ?? { count: 0, lastUploadAt: null };
    existing.count += 1;
    if (createdAt && (!existing.lastUploadAt || createdAt > existing.lastUploadAt)) {
      existing.lastUploadAt = createdAt;
    }
    counts.set(uid, existing);
  }

  return Array.from(counts.entries())
    .map(([uid, { count, lastUploadAt }]) => ({
      uid,
      fullName: nameByUid.get(uid) ?? '(unknown patient)',
      email: emailByUid.get(uid) ?? null,
      photoCount: count,
      lastUploadAt,
    }))
    .sort((a, b) => (b.lastUploadAt ?? '').localeCompare(a.lastUploadAt ?? ''));
}