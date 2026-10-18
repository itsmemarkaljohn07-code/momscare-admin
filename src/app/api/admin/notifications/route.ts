import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/get-admin-session';
import {
  latestAdminNotificationId,
  listAdminNotifications,
  markAdminNotificationsRead,
  notifyAppointmentRequest,
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
export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }
  try {
    // ?head=1: just the newest id (one read), polled often by an open bell.
    if (req.nextUrl.searchParams.get('head') === '1') {
      return NextResponse.json({ latestId: await latestAdminNotificationId() });
    }
    await syncAdminNotificationsThrottled();
    return NextResponse.json(await listAdminNotifications(session.uid));
  } catch (err: unknown) {
    console.error('Failed to load admin notifications:', (err as { code?: unknown })?.code ?? 'unknown');
    return NextResponse.json({ error: 'Could not load notifications.' }, { status: 500 });
  }
}

/** The browser saw a new appointment request live: record it now (the
 *  server re-reads the request, so only a real one creates anything),
 *  then return the list. */
export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const patientUid: unknown = body?.patientUid;
  const requestId: unknown = body?.requestId;
  if (
    typeof patientUid !== 'string' || !ID_PATTERN.test(patientUid) ||
    typeof requestId !== 'string' || !ID_PATTERN.test(requestId)
  ) {
    return NextResponse.json({ error: 'A patient and request are required.' }, { status: 400 });
  }
  try {
    await notifyAppointmentRequest(patientUid, requestId);
    return NextResponse.json(await listAdminNotifications(session.uid));
  } catch (err: unknown) {
    console.error('Failed to record appointment request:', (err as { code?: unknown })?.code ?? 'unknown');
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
