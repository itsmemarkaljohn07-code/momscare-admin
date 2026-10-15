// scripts/revoke-sessions.ts
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// One-off: signs every dashboard account out everywhere by revoking its
// refresh tokens, which also invalidates every existing session cookie
// (the dashboard checks revocation on each request). Covers every admin
// (admins/{uid}) and every doctor login (doctors.authUid).
//
// Dry run by default — prints what would be revoked and changes nothing:
//   npx tsx scripts/revoke-sessions.ts
// Revoke:
//   npx tsx scripts/revoke-sessions.ts --apply
//
// Output is limited to counts and the first 6 characters of each uid.

const short = (uid: string) => `${uid.slice(0, 6)}…`;

async function main() {
  const apply = process.argv.includes('--apply');

  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }
  const db = getFirestore();
  const auth = getAuth();

  console.log(apply ? 'Mode: APPLY (revoking)' : 'Mode: DRY RUN (no changes)');

  const [admins, doctors] = await Promise.all([
    db.collection('admins').get(),
    db.collection('doctors').get(),
  ]);

  const adminUids = admins.docs.map((d) => d.id);
  const doctorUids = doctors.docs
    .map((d) => d.data().authUid)
    .filter((uid): uid is string => typeof uid === 'string' && uid.length > 0);
  const uids = [...new Set([...adminUids, ...doctorUids])];

  console.log(
    `admins=${adminUids.length} doctors=${doctors.size} (with a login: ${doctorUids.length}) unique accounts=${uids.length}`
  );

  let revoked = 0;
  let missing = 0;
  let failed = 0;
  for (const uid of uids) {
    const role = adminUids.includes(uid) ? 'admin' : 'doctor';
    if (!apply) {
      console.log(`  would revoke ${role} ${short(uid)}`);
      continue;
    }
    try {
      await auth.revokeRefreshTokens(uid);
      revoked++;
      console.log(`  revoked ${role} ${short(uid)}`);
    } catch (err) {
      const code = (err as { code?: string })?.code ?? 'unknown';
      if (code === 'auth/user-not-found') {
        missing++;
        console.log(`  no login account for ${role} ${short(uid)} (skipped)`);
      } else {
        failed++;
        console.log(`  FAILED ${role} ${short(uid)}: ${code}`);
      }
    }
  }

  if (apply) {
    console.log(`Done. revoked=${revoked} no-account=${missing} failed=${failed}`);
    if (failed > 0) process.exit(1);
  } else {
    console.log('Dry run only. Re-run with --apply to revoke.');
  }
}

main().catch((err) => {
  console.error('Revocation failed:', (err as { code?: string })?.code ?? 'unknown');
  process.exit(1);
});
