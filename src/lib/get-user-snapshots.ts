import { adminDb } from '@/lib/firebase-admin';
import { getUserById } from '@/lib/get-users';

export interface AdminSnapshotPhoto {
  id: string;
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

export interface SnapshotDayGroup {
  dateKey: string;
  label: string;
  items: AdminSnapshotPhoto[];
}

// Mirrors the exact day-grouping logic used on the patient's own
// Snapshot page, so an admin sees the identical "Today — ..." /
// plain-date grouping the patient sees.
function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatGroupLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const groupDate = new Date(y, m - 1, d);
  const formatted = groupDate.toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
  const todayKey = toLocalDateKey(new Date());
  return dateKey === todayKey ? `Today — ${formatted}` : formatted;
}

export async function getUserSnapshots(uid: string) {
  const [patient, snapshot] = await Promise.all([
    getUserById(uid),
    adminDb.collection('users').doc(uid).collection('snapshots').orderBy('createdAt', 'desc').get(),
  ]);

  const photos: AdminSnapshotPhoto[] = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      imageUrl: data.imageUrl,
      type: data.type,
      week: data.week,
      caption: data.caption,
      createdAt: data.createdAt?.toDate?.().toISOString() ?? null,
      healthSnapshot: data.healthSnapshot ?? undefined,
    };
  });

  const groups = new Map<string, AdminSnapshotPhoto[]>();
  for (const p of photos) {
    const key = p.createdAt ? toLocalDateKey(new Date(p.createdAt)) : 'unknown';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }

  const grouped: SnapshotDayGroup[] = Array.from(groups.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([dateKey, items]) => ({
      dateKey,
      label: dateKey === 'unknown' ? 'Unknown date' : formatGroupLabel(dateKey),
      items,
    }));

  return { patient, groups: grouped, totalPhotos: photos.length };
}