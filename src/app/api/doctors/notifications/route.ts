import { NextRequest, NextResponse } from 'next/server';
import { getDoctorSession } from '@/lib/get-doctor-session';
import {
  checkDoctorReplyThread,
  listDoctorNotifications,
  markDoctorNotificationsRead,
  syncDoctorReplyNotifications,
} from '@/lib/doctor-notifications';

const MAX_IDS = 100;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,200}$/;

// Doctor-only. Every read and write is scoped to the signed-in doctor's
// own doctors/{doctorId}/notifications; patients, admins and other
// doctors get 401 or only ever see their own records.

/** Dashboard load: full check, then the bell list and the threads the
 *  browser should watch live. */
export async function GET() {
  const session = await getDoctorSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }
  try {
    const watch = await syncDoctorReplyNotifications(session.doctorId, session.doctorName);
    return NextResponse.json({ ...(await listDoctorNotifications(session.doctorId)), watch });
  } catch (err: unknown) {
    console.error('Failed to load doctor notifications:', err);
    return NextResponse.json({ error: 'Could not load notifications.' }, { status: 500 });
  }
}

/** The browser saw a new patient comment on one thread: check just that
 *  thread (assignment re-verified on the server), then return the list. */
export async function POST(req: NextRequest) {
  const session = await getDoctorSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const patientUid: unknown = body?.patientUid;
  const photoId: unknown = body?.photoId;
  if (
    typeof patientUid !== 'string' || !ID_PATTERN.test(patientUid) ||
    typeof photoId !== 'string' || !ID_PATTERN.test(photoId)
  ) {
    return NextResponse.json({ error: 'A patient and photo are required.' }, { status: 400 });
  }

  try {
    await checkDoctorReplyThread(session.doctorId, session.doctorName, patientUid, photoId);
    return NextResponse.json(await listDoctorNotifications(session.doctorId));
  } catch (err: unknown) {
    console.error('Failed to check doctor reply thread:', err);
    return NextResponse.json({ error: 'Could not load notifications.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getDoctorSession();
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
    const updated = await markDoctorNotificationsRead(
      session.doctorId,
      all ? { all: true } : { ids: ids as string[] }
    );
    return NextResponse.json({ success: true, updated });
  } catch (err: unknown) {
    console.error('Failed to mark doctor notifications read:', err);
    return NextResponse.json({ error: 'Could not update notifications.' }, { status: 500 });
  }
}
