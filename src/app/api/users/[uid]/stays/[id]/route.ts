import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { ID_PATTERN, auditStay, docToStay, stayAccess, stayToDoc, staysCol } from '@/lib/stay-store';
import { validateStay } from '@/lib/stays';

type Ctx = { params: Promise<{ uid: string; id: string }> };

/** Admin only. PATCH: replace a stay's fields (validated, no overlap). */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { uid, id } = await params;
  const access = await stayAccess(uid);
  if (access instanceof NextResponse) return access;
  if (!ID_PATTERN.test(id)) return NextResponse.json({ error: 'Stay not found.' }, { status: 404 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });

  try {
    const result = await adminDb.runTransaction(async (tx) => {
      const all = await tx.get(staysCol(uid));
      const current = all.docs.find((d) => d.id === id);
      if (!current) return { kind: 'missing' as const };
      const others = all.docs.filter((d) => d.id !== id).map((d) => docToStay(d.data()));
      const checked = validateStay(body, others, Date.now());
      if (!checked.ok) return { kind: 'invalid' as const, errors: checked.errors };
      tx.update(current.ref, { ...stayToDoc(checked.stay), updatedAt: Timestamp.now() });
      return { kind: 'saved' as const };
    });
    if (result.kind === 'missing') return NextResponse.json({ error: 'Stay not found.' }, { status: 404 });
    if (result.kind === 'invalid') return NextResponse.json({ error: 'Check the highlighted fields.', fields: result.errors }, { status: 400 });
    await auditStay(access.session, uid, access.name, 'update');
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Failed to change stay:', (err as { code?: unknown })?.code ?? 'unknown');
    return NextResponse.json({ error: 'Could not save the stay. Please try again.' }, { status: 500 });
  }
}

/** Admin only. DELETE: remove a stay. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { uid, id } = await params;
  const access = await stayAccess(uid);
  if (access instanceof NextResponse) return access;
  if (!ID_PATTERN.test(id)) return NextResponse.json({ error: 'Stay not found.' }, { status: 404 });
  try {
    const ref = staysCol(uid).doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: 'Stay not found.' }, { status: 404 });
    await ref.delete();
    await auditStay(access.session, uid, access.name, 'delete');
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Failed to delete stay:', (err as { code?: unknown })?.code ?? 'unknown');
    return NextResponse.json({ error: 'Could not delete the stay. Please try again.' }, { status: 500 });
  }
}
