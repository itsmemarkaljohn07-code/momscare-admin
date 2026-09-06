import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Runs on the Edge runtime, so it can NOT use the Firebase Admin SDK
// directly. This only checks whether a session cookie exists at all —
// a fast first gate. The real cryptographic verification (is this
// cookie genuine? is this UID still an admin?) happens in
// src/app/admin/admin-layout.tsx, which runs as a Server Component in
// the Node.js runtime where firebase-admin actually works.
export function middleware(request: NextRequest) {
  const session = request.cookies.get('session')?.value;

  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};