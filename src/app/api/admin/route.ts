import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { getAdminSession } from '@/lib/get-admin-session';

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!email || !password || password.length < 6) {
    return NextResponse.json(
      { error: 'A valid email and a password of at least 6 characters are required.' },
      { status: 400 }
    );
  }

  try {
    const newUser = await adminAuth.createUser({ email, password });
    await adminDb.collection('admins').doc(newUser.uid).set({
      role: 'admin',
      createdBy: session.uid,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, uid: newUser.uid });
  } catch (err: unknown) {
    // Clear messages for the cases an admin can fix; nothing internal leaks.
    const code = (err as { code?: string })?.code;
    if (code === 'auth/email-already-exists') {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
    }
    if (code === 'auth/invalid-email') {
      return NextResponse.json({ error: 'That email address is not valid.' }, { status: 400 });
    }
    if (code === 'auth/invalid-password') {
      return NextResponse.json({ error: 'The password must be at least 6 characters.' }, { status: 400 });
    }
    console.error('Failed to create admin:', code ?? err);
    return NextResponse.json({ error: 'Could not create the admin. Please try again.' }, { status: 500 });
  }
}