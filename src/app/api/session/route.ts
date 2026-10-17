import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { withRetry } from '@/lib/with-retry';

const SESSION_EXPIRES_IN_MS = 60 * 60 * 24 * 5 * 1000; // 5 days

export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json();
    if (!idToken) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    const decoded = await withRetry(() => adminAuth.verifyIdToken(idToken));

    const adminDoc = await withRetry(() =>
      adminDb.collection('admins').doc(decoded.uid).get()
    );
    if (!adminDoc.exists) {
      return NextResponse.json({ error: 'Not an admin account' }, { status: 403 });
    }

    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_EXPIRES_IN_MS,
    });

    const response = NextResponse.json({ success: true });
    response.cookies.set('session', sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_EXPIRES_IN_MS / 1000,
    });
    // One role per browser: an admin login ends any doctor session here.
    response.cookies.delete('doctor_session');

    return response;
  } catch (err: unknown) {
    console.error('session creation error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  // Revoke the account's sessions on the server so a copied cookie stops
  // working too. Verified without checkRevoked, so a missing, expired or
  // invalid cookie still logs out cleanly; failures are never reported.
  const sessionCookie = req.cookies.get('session')?.value;
  if (sessionCookie) {
    try {
      const decoded = await adminAuth.verifySessionCookie(sessionCookie, false);
      await adminAuth.revokeRefreshTokens(decoded.uid);
    } catch {
      // Nothing to revoke; the cookie is removed below either way.
    }
  }

  const response = NextResponse.json({ success: true });
  response.cookies.delete('session');
  return response;
}