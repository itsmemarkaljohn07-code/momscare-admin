/** A patient's appointment request, written by the MomCare app at
 *  users/{uid}/appointmentRequests/{id}. The app creates it 'pending' and
 *  may withdraw it; the dashboard server sets 'scheduled' (with
 *  appointmentId) or 'declined' (with adminNote). Shared by the server
 *  routes and the client page, so nothing here may import server code. */
export type AppointmentRequestStatus = 'pending' | 'scheduled' | 'declined' | 'withdrawn';

export interface AppointmentRequestOption {
  /** yyyy-MM-dd */
  date: string;
  /** "HH:mm", 24-hour */
  from: string;
  to: string;
}

export interface AppointmentRequestView {
  id: string;
  patientUid: string;
  /** The appointment name (the dashboard stores it as an appointment's `label`). */
  type: string;
  options: AppointmentRequestOption[];
  reason: string;
  notes: string;
  icon: string;
  accentColor: AccentColor;
  status: AppointmentRequestStatus;
  /** ms since epoch; 0 while the server time isn't known yet. */
  createdAt: number;
  adminNote: string;
  appointmentId: string;
}

/** Card icons and colours, the same lists the app and firestore.rules use. */
export const ICON_OPTIONS = ['🩺', '🔬', '🩸', '🥗', '👩‍⚕️', '💊', '🫀', '🧬'] as const;
export const COLOR_OPTIONS = ['green', 'pink', 'purple', 'blue', 'orange'] as const;
export type AccentColor = (typeof COLOR_OPTIONS)[number];

export const ADMIN_NOTE_MAX = 300;

/** Icon and colour an appointment gets when nobody chose one: per
 *  appointment name, so the patient's cards stay easy to tell apart. */
const DEFAULT_APPEARANCE: Record<string, { icon: string; accentColor: AccentColor }> = {
  'Prenatal Checkup':       { icon: '🩺', accentColor: 'pink' },
  'Booking Appointment':    { icon: '👩‍⚕️', accentColor: 'purple' },
  'Nuchal Scan':            { icon: '🔬', accentColor: 'blue' },
  'Anomaly Scan':           { icon: '🔬', accentColor: 'blue' },
  'Glucose Tolerance Test': { icon: '🩸', accentColor: 'orange' },
  'Group B Strep Test':     { icon: '🧬', accentColor: 'green' },
  'Ultrasound':             { icon: '🔬', accentColor: 'blue' },
  'Blood Test':             { icon: '🩸', accentColor: 'orange' },
  'Postpartum Checkup':     { icon: '🩺', accentColor: 'green' },
};
const FALLBACK_APPEARANCE = { icon: '🩺', accentColor: 'purple' as AccentColor };

export function isIcon(value: unknown): value is string {
  return typeof value === 'string' && (ICON_OPTIONS as readonly string[]).includes(value);
}

export function isAccentColor(value: unknown): value is AccentColor {
  return typeof value === 'string' && (COLOR_OPTIONS as readonly string[]).includes(value);
}

/** The icon and colour for a new appointment: the request's own choice when
 *  valid, otherwise the default for its appointment name. */
export function appearanceFor(
  label: unknown,
  chosen?: { icon?: unknown; accentColor?: unknown }
): { icon: string; accentColor: AccentColor } {
  const base = (typeof label === 'string' && DEFAULT_APPEARANCE[label]) || FALLBACK_APPEARANCE;
  return {
    icon: isIcon(chosen?.icon) ? chosen.icon : base.icon,
    accentColor: isAccentColor(chosen?.accentColor) ? chosen.accentColor : base.accentColor,
  };
}

/** "HH:mm" -> "h:mm AM/PM" */
export function to12Hour(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return time24;
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

/** "Tue, Nov 3 · 9:00 AM – 10:30 AM" */
export function formatRequestOption(o: AppointmentRequestOption): string {
  const d = new Date(`${o.date}T00:00:00`);
  const day = Number.isNaN(d.getTime())
    ? o.date
    : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return `${day} · ${to12Hour(o.from)} – ${to12Hour(o.to)}`;
}

/** A Firestore request document (client or admin SDK data) as a view row.
 *  Anything malformed is replaced with a safe empty value. */
export function toRequestView(id: string, patientUid: string, data: Record<string, unknown>): AppointmentRequestView {
  const options = Array.isArray(data.options)
    ? (data.options as unknown[]).filter(
        (o): o is AppointmentRequestOption =>
          !!o && typeof o === 'object' &&
          typeof (o as AppointmentRequestOption).date === 'string' &&
          typeof (o as AppointmentRequestOption).from === 'string' &&
          typeof (o as AppointmentRequestOption).to === 'string'
      )
    : [];
  const created = data.createdAt as { toMillis?: () => number } | undefined;
  const status = data.status;
  return {
    id,
    patientUid,
    type: typeof data.type === 'string' ? data.type : '',
    options,
    reason: typeof data.reason === 'string' ? data.reason : '',
    notes: typeof data.notes === 'string' ? data.notes : '',
    icon: isIcon(data.icon) ? data.icon : FALLBACK_APPEARANCE.icon,
    accentColor: isAccentColor(data.accentColor) ? data.accentColor : FALLBACK_APPEARANCE.accentColor,
    status: status === 'scheduled' || status === 'declined' || status === 'withdrawn' ? status : 'pending',
    createdAt: typeof created?.toMillis === 'function' ? created.toMillis() : 0,
    adminNote: typeof data.adminNote === 'string' ? data.adminNote : '',
    appointmentId: typeof data.appointmentId === 'string' ? data.appointmentId : '',
  };
}
