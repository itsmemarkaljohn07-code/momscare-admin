import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { initializeFirestore } from 'firebase-admin/firestore';

function getAdminApp(): App {
  const existingApps = getApps();
  if (existingApps.length > 0) {
    return existingApps[0];
  }

  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      // The private key is stored with literal \n characters in
      // .env.local — this converts them back into real newlines,
      // which the Admin SDK requires to parse the key correctly.
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const adminApp = getAdminApp();

export const adminAuth = getAuth(adminApp);

// preferRest forces plain HTTP/1.1 REST transport instead of gRPC for
// all normal reads/writes. gRPC's own connection/DNS-resolution layer
// is more fragile than plain HTTPS under certain network conditions
// (antivirus HTTPS scanning, some routers/DNS setups) — this is the
// server-side equivalent of the experimentalForceLongPolling fix
// already applied to the mobile app's client-side Firestore SDK for
// the exact same class of problem. The only Firestore feature that
// still requires gRPC is a live onSnapshot() listener — this admin
// dashboard only ever reads/writes with plain get()/set()/update(),
// so nothing here needs gRPC at all.
export const adminDb = initializeFirestore(adminApp, { preferRest: true });