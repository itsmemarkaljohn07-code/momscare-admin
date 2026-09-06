import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getAdminSession } from '@/lib/get-admin-session';
import { Timestamp } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const body = await req.json();
  const { id, ...rest } = body;

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'A valid article ID is required.' }, { status: 400 });
  }

  const docRef = adminDb.collection('insights').doc(id);
  const existing = await docRef.get();

  if (existing.exists) {
    return NextResponse.json(
      { error: `An article with ID "${id}" already exists.` },
      { status: 409 }
    );
  }

  try {
    await docRef.set({
      ...rest,
      order: 0,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    return NextResponse.json({ success: true, id });
  } catch (err: unknown) {
    console.error('Failed to create insight:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}   