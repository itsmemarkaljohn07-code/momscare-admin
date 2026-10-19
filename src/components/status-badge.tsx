import {
  Ban, CalendarClock, CalendarX, CheckCheck, CircleAlert, CircleCheck, CircleX, Hourglass, Timer, type LucideIcon,
} from 'lucide-react';
import { computeDisplayStatus } from '@/lib/appointment-status';
import type { AppointmentCancellation } from '@/lib/appointment-cancellation';

// Every status shows an icon and a text label (never colour alone). Colours
// come from the existing --status-* CSS variables.
const STATUS_MAP: Record<string, { label: string; icon: LucideIcon; color: string; bg: string }> = {
  pending:   { label: 'Pending approval', icon: Hourglass,   color: 'var(--status-pending)',   bg: 'var(--status-pending-bg)' },
  approved:  { label: 'Approved',         icon: CircleCheck, color: 'var(--status-approved)',  bg: 'var(--status-approved-bg)' },
  rejected:  { label: 'Declined',         icon: CircleX,     color: 'var(--status-declined)',  bg: 'var(--status-declined-bg)' },
  upcoming:  { label: 'Upcoming',         icon: CalendarClock, color: 'var(--status-upcoming)', bg: 'var(--status-upcoming-bg)' },
  ongoing:   { label: 'Ongoing',          icon: Timer,       color: 'var(--status-approved)',  bg: 'var(--status-approved-bg)' },
  completed: { label: 'Completed',        icon: CheckCheck,  color: 'var(--status-completed)', bg: 'var(--status-completed-bg)' },
  cancelled: { label: 'Cancelled',        icon: Ban,         color: 'var(--status-cancelled)', bg: 'var(--status-cancelled-bg)' },
  missed:    { label: 'Missed',           icon: CircleAlert, color: 'var(--status-declined)',  bg: 'var(--status-declined-bg)' },
  cancellation_requested: { label: 'Cancellation requested', icon: CalendarX, color: 'var(--status-pending)', bg: 'var(--status-pending-bg)' },
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const key = status.toLowerCase();
  const entry = STATUS_MAP[key];
  const Icon = entry?.icon;
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ color: entry?.color ?? 'var(--muted-foreground)', backgroundColor: entry?.bg ?? 'var(--muted)' }}
    >
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      {label ?? entry?.label ?? status}
    </span>
  );
}

/** An appointment's status, taking a patient's cancellation request into
 *  account: an open request on an upcoming appointment shows as
 *  "Cancellation requested", a cancelled one as "Cancelled", and a
 *  declined request adds a small note under the usual status. */
export function AppointmentStatus({
  appointment,
}: {
  appointment: { date: string; time: string; status: string; cancellation?: AppointmentCancellation };
}) {
  const { date, time, status, cancellation } = appointment;

  if (status === 'upcoming' && cancellation?.state === 'requested') {
    return (
      <span title={cancellation.reason ? `Patient's reason: ${cancellation.reason}` : undefined}>
        <StatusBadge status="cancellation_requested" />
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <StatusBadge status={computeDisplayStatus(date, time, status)} />
      {status !== 'cancelled' && cancellation?.state === 'declined' && (
        <span
          className="text-[11px] leading-tight text-muted-foreground"
          title={cancellation.declineReason || undefined}
        >
          Cancellation declined
        </span>
      )}
    </span>
  );
}