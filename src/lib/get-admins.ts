import { adminAuth, adminDb } from '@/lib/firebase-admin';

export interface AdminView {
  uid: string;
  email: string | null;
  createdAt: string | null;
}

export async function getAdmins(): Promise<AdminView[]> {
  const snapshot = await adminDb.collection('admins').get();

  const admins: AdminView[] = [];
  for (const doc of snapshot.docs) {
    try {
      const user = await adminAuth.getUser(doc.id);
      admins.push({
        uid: doc.id,
        email: user.email ?? null,
        createdAt: doc.data().createdAt ?? user.metadata.creationTime ?? null,
      });
    } catch {
      // The Auth account no longer exists but the admins/{uid} doc does
      // — an orphaned record. Skip it rather than crash the list.
    }
  }

  return admins.sort((a, b) => (a.email ?? '').localeCompare(b.email ?? ''));
}

export async function getAdminById(uid: string): Promise<AdminView | null> {
  const doc = await adminDb.collection('admins').doc(uid).get();
  if (!doc.exists) return null;

  try {
    const user = await adminAuth.getUser(uid);
    return {
      uid,
      email: user.email ?? null,
      createdAt: doc.data()?.createdAt ?? user.metadata.creationTime ?? null,
    };
  } catch {
    return null;
  }
}