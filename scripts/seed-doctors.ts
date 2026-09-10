// scripts/seed-doctors.ts
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// The same testing roster previously hardcoded in the appointment
// form — seeded here once so existing appointment records (which
// already reference these exact doctor names) keep matching
// correctly. Manage doctors going forward via the Doctors page in
// the dashboard, not by re-running this script.
const DOCTORS = [
  { name: 'Dr. Maria Santos',       specialty: 'OB-GYN',            workingDays: [1,2,3,4,5],   startTime: '09:00', endTime: '16:00', slotMinutes: 30 },
  { name: 'Dr. Isabel Cruz',        specialty: 'OB-GYN',            workingDays: [1,3,5],       startTime: '10:00', endTime: '15:00', slotMinutes: 30 },
  { name: 'Dr. Juan Dela Cruz',     specialty: 'General Physician', workingDays: [1,2,3,4,5,6], startTime: '08:00', endTime: '17:00', slotMinutes: 20 },
  { name: 'Dr. Ricardo Villanueva', specialty: 'General Physician', workingDays: [2,4],         startTime: '09:00', endTime: '14:00', slotMinutes: 30 },
  { name: 'Dr. Ana Reyes',          specialty: 'Pediatrics',        workingDays: [1,2,3,4,5],   startTime: '09:00', endTime: '15:00', slotMinutes: 30 },
  { name: 'Dr. Grace Fernandez',    specialty: 'Pediatrics',        workingDays: [1,3,5],       startTime: '13:00', endTime: '17:00', slotMinutes: 30 },
  { name: 'Dr. Roberto Garcia',     specialty: 'Obstetrics',        workingDays: [1,2,3,4,5],   startTime: '08:00', endTime: '12:00', slotMinutes: 30 },
  { name: 'Dr. Ferdinand Aquino',   specialty: 'Obstetrics',        workingDays: [2,4,6],       startTime: '09:00', endTime: '16:00', slotMinutes: 45 },
  { name: 'Dr. Carmen Villareal',   specialty: 'Radiology',         workingDays: [1,2,3,4,5],   startTime: '09:00', endTime: '16:00', slotMinutes: 30 },
  { name: 'Dr. Jose Mendoza',       specialty: 'Laboratory',        workingDays: [1,2,3,4,5,6], startTime: '07:00', endTime: '15:00', slotMinutes: 20 },
  { name: 'Dr. Miguel Ramos',       specialty: 'Laboratory',        workingDays: [1,3,5],       startTime: '08:00', endTime: '14:00', slotMinutes: 20 },
  { name: 'Dr. Angelica Torres',    specialty: 'Dietitian',         workingDays: [2,4],         startTime: '10:00', endTime: '16:00', slotMinutes: 45 },
  { name: 'Dr. Ramon Bautista',     specialty: 'Cardiology',        workingDays: [1,3,5],       startTime: '09:00', endTime: '13:00', slotMinutes: 30 },
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
  const db = getFirestore();

  console.log(`Seeding ${DOCTORS.length} doctors...`);
  for (const doc of DOCTORS) {
    await db.collection('doctors').add({ ...doc, createdAt: Timestamp.now() });
    console.log(`✓ ${doc.name}`);
  }
  console.log('Done.');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});