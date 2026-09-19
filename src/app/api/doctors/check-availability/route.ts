import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { getAdminSession } from '@/lib/get-admin-session';

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const rawUsername = searchParams.get('username')?.trim().toLowerCase() ?? '';
  const rawEmail = searchParams.get('email')?.trim().toLowerCase() ?? '';

  const result: { usernameTaken?: boolean; emailTaken?: boolean } = {};

  if (rawUsername.length >= 3) {
    const existing = await adminDb
      .collection('doctors')
      .where('username', '==', rawUsername)
      .limit(1)
      .get();
    result.usernameTaken = !existing.empty;
  }

  if (rawEmail.includes('@')) {
    try {
      await adminAuth.getUserByEmail(rawEmail);
      result.emailTaken = true;
    } catch (err: any) {
      // auth/user-not-found means it's free; any other error (network,
      // rate limit, etc.) is left undefined so the client doesn't block
      // on an inconclusive check — the create route re-validates anyway.
      result.emailTaken = err?.code === 'auth/user-not-found' ? false : undefined;
    }
  }

  return NextResponse.json(result);
}