// Readable names for the patient deletion dialog: the subcollections in
// the preview and the steps in the result. Pure, so it can be unit-tested.

import type { StepName, StepStatus } from '@/lib/patient-deletion';

/** users/{uid} subcollections by name. One without a label shows its raw name. */
export const COLLECTION_LABELS: Record<string, string> = {
  appointments: 'Appointments',
  snapshots: 'Snapshot records',
  health: 'Health tracker records',
  healthLogs: 'Health log entries',
  checklist: 'Checklist items',
  notifications: 'Notifications',
  clinicalNotes: 'Clinical notes',
  clinicReadings: 'Clinic health readings',
  stays: 'Birth stays',
};

/** The deletion steps, in the order they run. */
export const STEP_LABELS: Record<StepName, string> = {
  disable_login: 'Disable sign-in and revoke sessions',
  read_data: 'Read username and photo IDs',
  cloudinary_images: 'Delete photos on Cloudinary',
  firestore_data: 'Delete profile and all records',
  username: 'Release username',
  audit_history: 'Anonymise past audit entries',
  login_account: 'Delete login account',
  audit_entry: 'Record audit entry',
};

export const STATUS_LABELS: Record<StepStatus, string> = {
  done: 'Done',
  already_gone: 'Already gone',
  skipped: 'Skipped',
  failed: 'Failed',
};

export function collectionLabel(name: string): string {
  return COLLECTION_LABELS[name] ?? name;
}
