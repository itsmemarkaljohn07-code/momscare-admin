import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { getAdminSession } from '@/lib/get-admin-session';

/**
 * TEMPORARY diagnostic route — not part of the app's normal
 * functionality. Checks Firebase Auth's actual current record for a
 * doctor's custom claims, bypassing any client-side token caching
 * entirely. Delete this file once the doctorName claim issue is
 * resolved.
 *
 * Usage: GET /api/admin/check-doctor-claims?doctorId=<doctors/{id}>
 */
export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const doctorId = req.nextUrl.searchParams.get('doctorId');
  if (!doctorId) {
    return NextResponse.json({ error: 'Pass ?doctorId=<the doctors/{id} document id>' }, { status: 400 });
  }

  const doctorDoc = await adminDb.collection('doctors').doc(doctorId).get();
  if (!doctorDoc.exists) {
    return NextResponse.json({ error: 'No doctor found with that id.' }, { status: 404 });
  }
  const doctorData = doctorDoc.data()!;
  const authUid: string | undefined = doctorData.authUid;

  if (!authUid) {
    return NextResponse.json({
      doctorId,
      storedName: doctorData.name,
      authUid: null,
      note: 'This doctor has no authUid on file at all — no login has ever been set up for them.',
    });
  }

  try {
    const authUser = await adminAuth.getUser(authUid);
    return NextResponse.json({
      doctorId,
      storedNameInFirestore: doctorData.name,
      authUid,
      email: authUser.email,
      // This is the actual ground truth — what Firebase Auth has
      // stored for this user right now, server-side.
      customClaims: authUser.customClaims ?? null,
    });
  } catch (err) {
    return NextResponse.json({
      doctorId,
      authUid,
      error: 'adminAuth.getUser() failed for this authUid — the Auth account may not exist at all.',
      details: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }
}