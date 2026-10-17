// Appointment names and the doctor specialties that can handle each one.
// Shared by the admin appointment form and the request Schedule dialog.

export const TYPE_OPTIONS = [
  'Obstetrics', 'OB-GYN', 'Radiology', 'Laboratory',
  'Dietitian', 'Cardiology', 'Pediatrics', 'General Physician', 'Other',
];

export const NAME_TO_TYPES: Record<string, string[]> = {
  'Prenatal Checkup': ['Obstetrics', 'OB-GYN', 'General Physician'],
  'Booking Appointment': ['Obstetrics', 'OB-GYN'],
  'Nuchal Scan': ['Radiology', 'OB-GYN'],
  'Anomaly Scan': ['Radiology', 'OB-GYN'],
  'Glucose Tolerance Test': ['Laboratory', 'Dietitian'],
  'Group B Strep Test': ['Laboratory'],
  'Ultrasound': ['Radiology', 'OB-GYN'],
  'Blood Test': ['Laboratory'],
  'Postpartum Checkup': ['Obstetrics', 'OB-GYN', 'General Physician'],
  'Other': TYPE_OPTIONS,
};

/** Specialties that can take an appointment of this name (any, when unknown). */
export function specialtiesFor(name: string): string[] {
  return NAME_TO_TYPES[name] ?? TYPE_OPTIONS;
}
