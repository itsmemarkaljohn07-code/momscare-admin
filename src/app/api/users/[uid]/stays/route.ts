import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { auditStay, docToStay, stayAccess, stayToDoc, staysCol } from '@/lib/stay-store';
import { validateStay } from '@/lib/stays';

/** Admin only. GET: the patient's birth stays, newest admission first. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;
  const access = await stayAccess(uid);
  if (access instanceof NextResponse) return access;
  try {
    const snap = await staysCol(uid).get();
    const stays = snap.docs
      .map((d) => ({ id: d.id, ...docToStay(d.data()) }))
      .sort((a, b) => b.admittedAt - a.admittedAt);
    return NextResponse.json({ stays });
  } catch (err: unknown) {
    console.error('Failed to list stays:', (err as { code?: unknown })?.code ?? 'unknown');
    return NextResponse.json({ error: 'Could not load the stays.' }, { status: 500 });
  }
}

/** Admin only. POST: add a birth stay (validated, no overlap). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;
  const access = await stayAccess(uid);
  if (access instanceof NextResponse) return access;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });

  try {
    const ref = staysCol(uid).doc();
    // Overlap check and write in one transaction.
    const result = await adminDb.runTransaction(async (tx) => {
      const others = (await tx.get(staysCol(uid))).docs.map((d) => docToStay(d.data()));
      const checked = validateStay(body, others, Date.now());
      if (!checked.ok) return checked;
      const now = Timestamp.now();
      tx.create(ref, { ...stayToDoc(checked.stay), enteredBy: access.session.uid, enteredAt: now, updatedAt: now });
      return checked;
    });
    if (!result.ok) return NextResponse.json({ error: 'Check the highlighted fields.', fields: result.errors }, { status: 400 });
    await auditStay(access.session, uid, access.name, 'create');
    return NextResponse.json({ success: true, id: ref.id });
  } catch (err: unknown) {
    console.error('Failed to add stay:', (err as { code?: unknown })?.code ?? 'unknown');
    return NextResponse.json({ error: 'Could not save the stay. Please try again.' }, { status: 500 });
  }
}
