const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: 'Pending Doctor Approval', color: 'var(--status-pending)',   bg: 'var(--status-pending-bg)' },
  approved:  { label: 'Approved',                color: 'var(--status-approved)',  bg: 'var(--status-approved-bg)' },
  rejected:  { label: 'Declined',                color: 'var(--status-declined)',  bg: 'var(--status-declined-bg)' },
  upcoming:  { label: 'Upcoming',                color: 'var(--status-upcoming)',  bg: 'var(--status-upcoming-bg)' },
  ongoing:   { label: 'Ongoing',                 color: 'var(--status-approved)',  bg: 'var(--status-approved-bg)' },
  completed: { label: 'Completed',               color: 'var(--status-completed)', bg: 'var(--status-completed-bg)' },
  cancelled: { label: 'Cancelled',                color: 'var(--status-cancelled)', bg: 'var(--status-cancelled-bg)' },
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