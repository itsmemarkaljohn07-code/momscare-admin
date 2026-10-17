import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { cookies } from 'next/headers';
import { withRetry } from '@/lib/with-retry';

const SESSION_EXPIRES_IN = 60 * 60 * 24 * 5 * 1000; // 5 days

export async function POST(req: NextRequest) {
  const { idToken } = await req.json();
  if (!idToken) {
    return NextResponse.json({ error: 'Missing token.' }, { status: 400 });
  }

  try {
    const decoded = await withRetry(() => adminAuth.verifyIdToken(idToken));
    if (!decoded.doctorId) {
      return NextResponse.json(
        { error: 'This account does not have healthcare provider access.' },
        { status: 403 }
      );
    }

    const sessionCookie = await withRetry(() =>
      adminAuth.createSessionCookie(idToken, { expiresIn: SESSION_EXPIRES_IN })
    );

    const cookieStore = await cookies();
    cookieStore.set('doctor_session', sessionCookie, {
      maxAge: SESSION_EXPIRES_IN / 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax',
    });
    // One role per browser: a doctor login ends any admin session here.
    cookieStore.delete('session');

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Doctor session creation error:', err);
    return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
  }
}

export async function DELETE() {
  const cookieStore = await cookies();

  // Revoke the doctor's sessions on the server so a copied cookie stops
  // working too. Verified without checkRevoked, so a missing, expired or
  // invalid cookie still logs out cleanly; failures are never reported.
  const sessionCookie = cookieStore.get('doctor_session')?.value;
  if (sessionCookie) {
    try {
      const decoded = await adminAuth.verifySessionCookie(sessionCookie, false);
      await adminAuth.revokeRefreshTokens(decoded.uid);
    } catch {
      // Nothing to revoke; the cookie is removed below either way.
    }
  }

  cookieStore.delete('doctor_session');
  return NextResponse.json({ success: true });
}