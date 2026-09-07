import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { getAdminSession } from '@/lib/get-admin-session';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const { uid } = await params;
  const { disabled } = await req.json();

  if (typeof disabled !== 'boolean') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  try {
    await adminAuth.updateUser(uid, { disabled });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Failed to update user status:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}