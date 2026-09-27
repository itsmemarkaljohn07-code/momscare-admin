import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/get-admin-session';
import { buildSearchIndex } from '@/lib/build-search-index';

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const items = await buildSearchIndex();
  return NextResponse.json({ items });
}