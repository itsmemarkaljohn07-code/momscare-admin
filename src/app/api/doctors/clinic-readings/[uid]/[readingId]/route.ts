import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { manilaKey } from '@/lib/report-aggregations';
import { editedReadingFields, validateReading } from '@/lib/clinic-readings';
import { auditReading, ID_PATTERN, jsonBody, readingAccess, readingsCol } from '@/lib/clinic-reading-store';

type Params = { params: Promise<{ uid: string; readingId: string }> };

/** The stored reading, when it exists and this doctor entered it (like
 *  clinical notes: a doctor changes only their own entries). */
async function ownReading(uid: string, readingId: string, doctorUid: string) {
  if (!ID_PATTERN.test(readingId)) return NextResponse.json({ error: 'Reading not found.' }, { status: 404 });
  const ref = readingsCol(uid).doc(readingId);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: 'Reading not found.' }, { status: 404 });
  if (snap.get('enteredByUid') !== doctorUid) {
    return NextResponse.json({ error: 'You can only change readings you entered.' }, { status: 403 });
  }
  return ref;
}

/** The assigned doctor who entered it. PATCH: replace the values. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { uid, readingId } = await params;
  const access = await readingAccess(uid);
  if (access instanceof NextResponse) return access;
  const body = await jsonBody(req);
  const result = validateReading(body, manilaKey(new Date()));
  if (!result.ok) return NextResponse.json({ error: 'Check the highlighted fields.', fields: result.errors }, { status: 400 });
  try {
    const ref = await ownReading(uid, readingId, access.session.uid);
    if (ref instanceof NextResponse) return ref;
    await ref.update(editedReadingFields(result.value, Timestamp.now()));
    await auditReading(access.session, uid, access.name, 'update');
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Failed to change a clinic reading:', (err as { code?: unknown })?.code ?? 'unknown');
    return NextResponse.json({ error: 'Could not save the reading. Please try again.' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { uid, readingId } = await params;
  const access = await readingAccess(uid);
  if (access instanceof NextResponse) return access;
  try {
    const ref = await ownReading(uid, readingId, access.session.uid);
    if (ref instanceof NextResponse) return ref;
    await ref.delete();
    await auditReading(access.session, uid, access.name, 'delete');
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Failed to delete a clinic reading:', (err as { code?: unknown })?.code ?? 'unknown');
    return NextResponse.json({ error: 'Could not delete the reading. Please try again.' }, { status: 500 });
  }
}
