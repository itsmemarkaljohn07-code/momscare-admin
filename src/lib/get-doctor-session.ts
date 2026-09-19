import { cookies } from 'next/headers';
import { adminAuth } from '@/lib/firebase-admin';

export interface DoctorSession {
  uid: string;
  email: string | null;
  doctorId: string;
  doctorName: string;
}

export async function getDoctorSession(): Promise<DoctorSession | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('doctor_session')?.value;
  if (!sessionCookie) return null;

  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    if (!decoded.doctorId || !decoded.doctorName) return null;
    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
      doctorId: decoded.doctorId,
      doctorName: decoded.doctorName,
    };
  } catch {
    return null;
  }
}