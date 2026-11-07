// Readable names for audit log actions, shared by the audit log table
// and the activity summary PDF.

export const ACTION_LABELS: Record<string, string> = {
  'appointment.approve': 'Approved appointment',
  'appointment.decline': 'Declined appointment',
  'appointment.status_change': 'Changed appointment status',
  'appointment.edit': 'Edited appointment',
  'appointment.delete': 'Deleted appointment',
  'appointment.cancel_approve': 'Approved cancellation request',
  'appointment.cancel_decline': 'Declined cancellation request',
  'appointment.cancel_request': 'Requested cancellation (patient)',
  'appointment.cancel_withdraw': 'Withdrew cancellation request (patient)',
  'appointment_request.create': 'Sent appointment request (patient)',
  'appointment_request.withdraw': 'Withdrew appointment request (patient)',
  'appointment_request.schedule': 'Scheduled appointment request',
  'appointment_request.decline': 'Declined appointment request',
  'clinical_note.create': 'Added clinical note',
  'clinical_note.delete': 'Deleted clinical note',
  'clinic_reading.create': 'Health reading added',
  'clinic_reading.update': 'Health reading changed',
  'clinic_reading.delete': 'Health reading deleted',
  'doctor.create': 'Added doctor',
  'doctor.create_account': 'Created doctor account',
  'doctor.setup_login': 'Set up doctor login',
  'doctor.reset_login': 'Reset doctor login',
  'doctor.update': 'Updated doctor',
  'doctor.delete': 'Removed doctor',
  'user.suspend': 'Suspended patient account',
  'user.reactivate': 'Reactivated patient account',
  'user.delete': 'Permanently deleted patient account',
  'user.delete_incomplete': 'Partly deleted patient account (retry needed)',
  'user.dob_update': 'Updated patient date of birth',
  'stay.create': 'Added birth stay',
  'stay.update': 'Changed birth stay',
  'stay.delete': 'Deleted birth stay',
  'admin.remove_access': 'Removed admin access',
  'report.patient_export': 'Exported patient report (PDF)',
  'report.activity_export': 'Exported activity summary (PDF)',
  'report.prenatal_export': 'Exported a monthly clinic report',
  'report.pregnant_list_export': 'Exported the List of Pregnant Women',
};

/** The readable label, or the raw key for an action without one. */
export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}
