import { adminDb } from '@/lib/firebase-admin';
import { withRetry } from '@/lib/with-retry';

export interface DoctorSnapshotPhoto {
  id: string;
  patientUid: string;
  patientName: string;
  imageUrl: string;
  type: 'bump' | 'ultrasound' | 'milestone';
  week: number;
  caption: string;
  createdAt: string | null;
  healthSnapshot?: {
    weight: number;
    bpSys: number;
    bpDia: number;
    kicks: number;
    mood: number;
  };
}

export interface DoctorSnapshotDayGroup {
  dateKey: string;
  label: string;
  items: DoctorSnapshotPhoto[];
}

function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatGroupLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const groupDate = new Date(y, m - 1, d);
  const formatted = groupDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const todayKey = toLocalDateKey(new Date());
  return dateKey === todayKey ? `Today — ${formatted}` : formatted;
}

export async function getDoctorAllSnapshots(doctorName: string): Promise<DoctorSnapshotDayGroup[]> {
  const usersSnap = await withRetry(() =>
    adminDb
      .collection('users')
      .where('assignedDoctorNames', 'array-contains', doctorName)
      .get()
  );

  if (usersSnap.empty) return [];

  const nameByUid = new Map(usersSnap.docs.map((d) => [d.id, d.data().fullName ?? '(unnamed patient)']));
  const patientUids = new Set(usersSnap.docs.map((d) => d.id));

    const snapshotsSnap = await withRetry(() => adminDb.collectionGroup('snapshots').get());

  const photos: DoctorSnapshotPhoto[] = [];
  for (const doc of snapshotsSnap.docs) {
    const uid = doc.ref.parent.parent?.id;
    if (!uid || !patientUids.has(uid)) continue;
    const data = doc.data();
    photos.push({
      id: doc.id,
      patientUid: uid,
      patientName: nameByUid.get(uid) ?? '(unknown patient)',
      imageUrl: data.imageUrl,
      type: data.type,
      week: data.week,
      caption: data.caption,
      createdAt: data.createdAt?.toDate?.().toISOString() ?? null,
      healthSnapshot: data.healthSnapshot ?? undefined,
    });
  }

  const groups = new Map<string, DoctorSnapshotPhoto[]>();
  for (const p of photos) {
    const key = p.createdAt ? toLocalDateKey(new Date(p.createdAt)) : 'unknown';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }
  for (const items of groups.values()) {
    items.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  }

  return Array.from(groups.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([dateKey, items]) => ({
      dateKey,
      label: dateKey === 'unknown' ? 'Unknown date' : formatGroupLabel(dateKey),
      items,
    }));
}