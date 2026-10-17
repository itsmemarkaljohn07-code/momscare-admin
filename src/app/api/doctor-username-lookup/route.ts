import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

/** Resolves a doctor's username to their real login email — used by
 *  the login page BEFORE calling Firebase's own client-side
 *  signInWithEmailAndPassword, since that method has no native
 *  "username" concept. Runs server-side via the Admin SDK so no new
 *  public/unauthenticated Firestore read rule is ever needed. Returns
 *  a generic error on no-match, never revealing whether a username
 *  exists. */

// Simple per-IP limit to slow down username guessing. It lives in this
// server instance's memory, so on Vercel each instance counts on its own
// and a cold start resets it: a speed bump, not a hard limit.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  if (hits.size > 5_000) {
    for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
  }
  const entry = hits.get(ip);
  if (!entry || entry.resetAt <= now) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  if (rateLimited(ip)) {
    return NextResponse.json({ error: 'Too many attempts.' }, { status: 429 });
  }

  const { username } = await req.json().catch(() => ({ username: '' }));
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