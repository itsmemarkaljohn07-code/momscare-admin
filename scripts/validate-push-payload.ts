// scripts/validate-push-payload.ts
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { buildPushMessage, type PushContent } from '../src/lib/push-message';
import { REQUEST_PUSH_BODY, REQUEST_PUSH_TITLE } from '../src/lib/appointment-requests';

// Validates every push the dashboard sends with FCM's dry-run mode:
// FCM checks the payload and credentials but delivers nothing. Sent to a
// topic nobody subscribes to, so no device token is needed.
//   npx tsx scripts/validate-push-payload.ts

const DRY_RUN_TOPIC = 'momcare-dry-run-validation';

const FLOWS: PushContent[] = [
  { type: 'appointment_created', refId: 'apptDryRun', route: '/appointments',
    title: 'New Appointment Scheduled',
    body: 'Mommy, a new appointment has been scheduled for you. Tap to view the details.' },
  { type: 'appointment_approved', refId: 'apptDryRun', route: '/appointments',
    title: 'Appointment Approved',
    body: 'Good news, Mommy! Your doctor has approved your appointment. Tap to view the details.' },
  { type: 'appointment_declined', refId: 'apptDryRun', route: '/appointments',
    title: 'Appointment Update',
    body: 'Mommy, your doctor has updated your appointment. Open MomCare to view the details.' },
  { type: 'doctor_comment', refId: 'photoDryRun', route: '/snapshot',
    title: 'Your Doctor Left a Comment',
    body: 'Mommy, your doctor has shared an update on your pregnancy Snapshot. Tap to view it.' },
  { type: 'cancellation_update', refId: 'apptDryRun', route: '/appointments',
    title: 'Cancellation Update',
    body: 'Mommy, there is an update on your cancellation request. Open MomCare to view the details.' },
  { type: 'appointment_request_scheduled', refId: 'apptDryRun', route: '/appointments',
    title: REQUEST_PUSH_TITLE, body: REQUEST_PUSH_BODY },
  { type: 'appointment_request_declined', refId: 'requestDryRun', route: '/appointments',
    title: REQUEST_PUSH_TITLE, body: REQUEST_PUSH_BODY },
];

async function main() {
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }
  const messaging = getMessaging();

  let failures = 0;
  for (const flow of FLOWS) {
    try {
      await messaging.send({ topic: DRY_RUN_TOPIC, ...buildPushMessage(flow) }, true);
      console.log(`✓ ${flow.type}`);
    } catch (err) {
      failures++;
      const code = (err as { code?: string })?.code ?? 'unknown';
      console.error(`✗ ${flow.type}: ${code} ${err instanceof Error ? err.message : ''}`);
    }
  }

  console.log(failures === 0 ? 'All payloads valid (dry run, nothing delivered).' : `${failures} payload(s) rejected.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Validation failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
