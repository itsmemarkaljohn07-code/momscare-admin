import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/get-admin-session';
import {
  listAdminNotifications,
  markAdminNotificationsRead,
  syncAdminNotificationsThrottled,
} from '@/lib/admin-notifications';

const MAX_IDS = 100;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,300}$/;

// Admin-only. Every admin sees the same adminNotifications list; read
// state is stored per admin, so marking read never hides an entry from
// another admin.

/** The bell's list. Also runs the event check (at most once a minute per
 *  server instance) so entries appear while an admin has the page open,
 *  without waiting for the 30-minute sweep. */
export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }
  try {
    await syncAdminNotificationsThrottled();
    return NextResponse.json(await listAdminNotifications(session.uid));
  } catch (err: unknown) {
    console.error('Failed to load admin notifications:', (err as { code?: unknown })?.code ?? 'unknown');
    return NextResponse.json({ error: 'Could not load notifications.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const all = body?.all === true;
  const ids: unknown = body?.ids;
  const validIds =
    Array.isArray(ids) &&
    ids.length > 0 &&
    ids.length <= MAX_IDS &&
    ids.every((id) => typeof id === 'string' && ID_PATTERN.test(id));

  if (!all && !validIds) {
    return NextResponse.json({ error: 'Send { all: true } or a list of notification ids.' }, { status: 400 });
  }

  try {
    const updated = await markAdminNotificationsRead(
      session.uid,
      all ? { all: true } : { ids: ids as string[] }
    );
    return NextResponse.json({ success: true, updated });
  } catch (err: unknown) {
    console.error('Failed to mark admin notifications read:', (err as { code?: unknown })?.code ?? 'unknown');
    return NextResponse.json({ error: 'Could not update notifications.' }, { status: 500 });
  }
}
