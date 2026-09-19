import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { getAdminSession } from '@/lib/get-admin-session';

/**
 * One-time repair for accounts affected by the missing usernames/
 * write rule: their users/{uid}.username field saved fine at signup,
 * but the corresponding usernames/{username} lookup doc never got
 * created, so they can never log in via username even with correct
 * credentials. Backfills the missing doc from the Admin SDK, which
 * bypasses client rules entirely. Skips any username that already
 * has a doc, so this is safe to run more than once.
 */
export async function POST() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const usersSnap = await adminDb.collection('users').get();

  const results = {
    checked: 0,
    alreadyOk: 0,
    backfilled: [] as string[],
    skippedNoUsername: 0,
    skippedNoAuthEmail: 0,
    errors: [] as { uid: string; error: string }[],
  };

  for (const userDoc of usersSnap.docs) {
    results.checked++;
    const uid = userDoc.id;
    const username = (userDoc.data().username || '').trim().toLowerCase();

    if (!username) {
      results.skippedNoUsername++;
      continue;
    }

    try {
      const mappingRef = adminDb.collection('usernames').doc(username);
      const mappingDoc = await mappingRef.get();
      if (mappingDoc.exists) {
        results.alreadyOk++;
        continue;
      }

      // Use Auth's actual current email as the source of truth, not
      // whatever's cached on the profile doc — keeps the mapping
      // consistent with what Firebase Auth will actually accept.
      const authUser = await adminAuth.getUser(uid);
      if (!authUser.email) {
        results.skippedNoAuthEmail++;
        continue;
      }

      await mappingRef.set({ email: authUser.email, uid });
      results.backfilled.push(username);
    } catch (err) {
      results.errors.push({ uid, error: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  return NextResponse.json({ success: true, results });
}