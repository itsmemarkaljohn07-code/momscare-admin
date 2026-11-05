import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { manilaKey } from '@/lib/report-aggregations';
import { newReadingDoc, sortReadings, validateReading } from '@/lib/clinic-readings';
import { auditReading, jsonBody, readingAccess, readingFromDoc, readingsCol } from '@/lib/clinic-reading-store';

/**
 * The assigned doctor only. GET: the patient's clinic readings, newest
 * measuredOn first. POST: add one ({ weightKg, bpSys, bpDia, note,
 * measuredOn }); who entered it comes from the session.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;
  const access = await readingAccess(uid);
  if (access instanceof NextResponse) return access;
  try {
    const snap = await readingsCol(uid).get();
    const readings = sortReadings(snap.docs.map((d) => readingFromDoc(d.id, d.data())));
    return NextResponse.json({ readings, viewerUid: access.session.uid });
  } catch (err: unknown) {
    console.error('Failed to load clinic readings:', (err as { code?: unknown })?.code ?? 'unknown');
    return NextResponse.json({ error: 'Could not load the readings. Please try again.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;
  const access = await readingAccess(uid);
  if (access instanceof NextResponse) return access;
  const body = await jsonBody(req);
  const result = validateReading(body, manilaKey(new Date()));
  if (!result.ok) return NextResponse.json({ error: 'Check the highlighted fields.', fields: result.errors }, { status: 400 });
  try {
    const ref = await readingsCol(uid).add(newReadingDoc(result.value, access.session, Timestamp.now()));
    await auditReading(access.session, uid, access.name, 'create');
    return NextResponse.json({ success: true, id: ref.id });
  } catch (err: unknown) {
    console.error('Failed to add a clinic reading:', (err as { code?: unknown })?.code ?? 'unknown');
    return NextResponse.json({ error: 'Could not save the reading. Please try again.' }, { status: 500 });
  }
}
