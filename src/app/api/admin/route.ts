import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { getAdminSession } from '@/lib/get-admin-session';

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const { email, password } = await req.json();

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
    console.error('Failed to create admin:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}