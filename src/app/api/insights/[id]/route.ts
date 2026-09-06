import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getAdminSession } from '@/lib/get-admin-session';
import { Timestamp } from 'firebase-admin/firestore';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Defense in depth: even though this route is only ever called from
  // the already-gated /admin section, verify the session again here
  // directly, in case someone calls this API route on its own.
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  try {
    await adminDb.collection('insights').doc(id).update({
      title: body.title,
      heroTag: body.heroTag,
      readTime: body.readTime,
      youTubeUrl: body.youTubeUrl,
      citation: body.citation,
      updatedAt: Timestamp.now(),
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Failed to update insight:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}