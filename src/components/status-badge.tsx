import { computeDisplayStatus } from '@/lib/appointment-status';
import type { AppointmentCancellation } from '@/lib/appointment-cancellation';

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: 'Pending Doctor Approval', color: 'var(--status-pending)',   bg: 'var(--status-pending-bg)' },
  approved:  { label: 'Approved',                color: 'var(--status-approved)',  bg: 'var(--status-approved-bg)' },
  rejected:  { label: 'Declined',                color: 'var(--status-declined)',  bg: 'var(--status-declined-bg)' },
  upcoming:  { label: 'Upcoming',                color: 'var(--status-upcoming)',  bg: 'var(--status-upcoming-bg)' },
  ongoing:   { label: 'Ongoing',                 color: 'var(--status-approved)',  bg: 'var(--status-approved-bg)' },
  completed: { label: 'Completed',               color: 'var(--status-completed)', bg: 'var(--status-completed-bg)' },
  cancelled: { label: 'Cancelled',                color: 'var(--status-cancelled)', bg: 'var(--status-cancelled-bg)' },
  cancellation_requested: { label: 'Cancellation requested', color: 'var(--status-pending)', bg: 'var(--status-pending-bg)' },
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const key = status.toLowerCase();
  const entry = STATUS_MAP[key] ?? { label: label ?? status, color: 'var(--muted-foreground)', bg: 'var(--muted)' };
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ color: entry.color, backgroundColor: entry.bg }}
    >
      {label ?? entry.label}
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