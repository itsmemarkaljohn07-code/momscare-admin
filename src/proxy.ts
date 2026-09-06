import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// This still only checks whether a session cookie exists — a fast
// first gate. The real cryptographic verification (is this cookie
// genuine? is this UID still an admin?) happens in
// src/app/admin/admin-layout.tsx. (Note: Next.js 16's proxy.ts now
// always runs on the Node.js runtime, so firebase-admin could work
// directly here too — but we're deliberately keeping the two-layer
// split since it's already tested and working.)
export function proxy(request: NextRequest) {
  const session = request.cookies.get('session')?.value;

  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};