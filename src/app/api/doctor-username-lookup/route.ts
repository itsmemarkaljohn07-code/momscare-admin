import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

/** Resolves a doctor's username to their real login email — used by
 *  the login page BEFORE calling Firebase's own client-side
 *  signInWithEmailAndPassword, since that method has no native
 *  "username" concept. Runs server-side via the Admin SDK so no new
 *  public/unauthenticated Firestore read rule is ever needed. Returns
 *  a generic error on no-match, never revealing whether a username
 *  exists. */
export async function POST(req: NextRequest) {
  const { username } = await req.json();
  if (!username) {
    return NextResponse.json({ error: 'Username is required.' }, { status: 400 });
  }

  try {
    const snap = await adminDb
      .collection('doctors')
      .where('username', '==', username.trim().toLowerCase())
      .limit(1)
      .get();

    if (snap.empty) {
      return NextResponse.json({ error: 'Invalid username or password.' }, { status: 404 });
    }

    const email = snap.docs[0].data().loginEmail;
    if (!email) {
      return NextResponse.json({ error: 'Invalid username or password.' }, { status: 404 });
    }

    return NextResponse.json({ email });
  } catch (err: unknown) {
    console.error('Doctor username lookup failed:', err);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}