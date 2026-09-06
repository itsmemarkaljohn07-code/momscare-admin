import { cookies } from 'next/headers';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export interface AdminSession {
  uid: string;
  email: string | null;
}

/** The REAL verification: confirms the session cookie was genuinely
 *  issued by Firebase for this project, hasn't been revoked, and that
 *  the user still exists in the admins collection. Returns null if
 *  any of that fails. */
export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get('session')?.value;

  if (!session) return null;

  try {
    const decoded = await adminAuth.verifySessionCookie(session, true);
    const adminDoc = await adminDb.collection('admins').doc(decoded.uid).get();

    if (!adminDoc.exists) return null;

    return { uid: decoded.uid, email: decoded.email ?? null };
  } catch {
    return null;
  }
}