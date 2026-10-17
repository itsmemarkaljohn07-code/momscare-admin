'use client';

import { useMemo, useState } from 'react';
import { Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/empty-state';
import { AppointmentFormDialog } from '@/components/appointment-form-dialog';
import { RequestDecline } from '@/components/request-decline';
import { useLiveAppointmentRequests } from '@/hooks/use-live-appointment-requests';
import {
  formatRequestOption,
  type AccentColor,
  type AppointmentRequestStatus,
} from '@/lib/appointment-requests';
import type { AdminAppointment } from '@/lib/get-appointments';
import type { AdminUserView } from '@/lib/get-users';
import type { DoctorRecord } from '@/lib/get-doctors';

const STATUS_STYLE: Record<AppointmentRequestStatus, { label: string; color: string; bg: string }> = {
  pending:   { label: 'Pending',   color: 'var(--status-pending)',   bg: 'var(--status-pending-bg)' },
  scheduled: { label: 'Scheduled', color: 'var(--status-approved)',  bg: 'var(--status-approved-bg)' },
  declined:  { label: 'Declined',  color: 'var(--status-declined)',  bg: 'var(--status-declined-bg)' },
  withdrawn: { label: 'Withdrawn', color: 'var(--status-cancelled)', bg: 'var(--status-cancelled-bg)' },
};

/** The same card colours the patient app uses. */
const ACCENT_HEX: Record<AccentColor, string> = {
  green: '#00c9a7', pink: '#e07eb8', purple: '#b57fd4', blue: '#6aabf7', orange: '#f4956a',
};

type Filter = 'pending' | 'all';

export function AppointmentRequestsLive({
  users,
  doctors,
  appointments,
}: {
  users: AdminUserView[];
  doctors: DoctorRecord[];
  appointments: AdminAppointment[];
}) {
  const { requests, loaded } = useLiveAppointmentRequests();
  const [filter, setFilter] = useState<Filter>('pending');

  const names = useMemo(() => new Map(users.map((u) => [u.uid, u.fullName])), [users]);
  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const shown = filter === 'pending' ? requests.filter((r) => r.status === 'pending') : requests;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={filter === 'pending' ? 'default' : 'outline'}
          className="rounded-full"
          onClick={() => setFilter('pending')}
        >
          Pending ({pendingCount})
        </Button>
        <Button
          size="sm"
          variant={filter === 'all' ? 'default' : 'outline'}
          className="rounded-full"
          onClick={() => setFilter('all')}
        >
          All ({requests.length})
        </Button>
      </div>

      {!loaded ? (
        <p className="text-sm text-muted-foreground">Loading requests…</p>
      ) : shown.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={filter === 'pending' ? 'No pending requests' : 'No requests yet'}
          description="Appointment requests from patients appear here as soon as they are sent."
        />
      ) : (
        <ul className="space-y-3">
          {shown.map((r) => {
            const patientName = names.get(r.patientUid) ?? 'Unknown patient';
            const status = STATUS_STYLE[r.status];
            return (
              <li
                key={`${r.patientUid}/${r.id}`}
                className="rounded-2xl border bg-card p-4 shadow-soft"
                style={{ borderLeft: `4px solid ${ACCENT_HEX[r.accentColor]}` }}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 gap-3">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
                      style={{ backgroundColor: `${ACCENT_HEX[r.accentColor]}1f` }}
                      aria-hidden
                    >
                      {r.icon}
                    </span>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{r.type}</p>
                        <span
                          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                          style={{ color: status.color, backgroundColor: status.bg }}
                        >
                          {status.label}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {patientName}
                        {r.createdAt > 0 && (
                          <> · sent {new Date(r.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</>
                        )}
                      </p>
                      <ul className="text-sm">
                        {r.options.map((o) => (
                          <li key={`${o.date}-${o.from}`}>{formatRequestOption(o)}</li>
                        ))}
                      </ul>
                      <p className="text-sm">
                        <span className="text-muted-foreground">Reason: </span>
                        {r.reason}
                      </p>
                      {r.notes && (
                        <p className="text-sm">
                          <span className="text-muted-foreground">Notes: </span>
                          {r.notes}
                        </p>
                      )}
                      {r.status === 'declined' && r.adminNote && (
                        <p className="text-sm">
                          <span className="text-muted-foreground">Note to patient: </span>
                          {r.adminNote}
                        </p>
                      )}
                    </div>
                  </div>
                  {r.status === 'pending' && (
                    <div className="flex shrink-0 gap-2">
                      <AppointmentFormDialog
                        users={users}
                        appointments={appointments}
                        doctors={doctors}
                        request={{ ...r, patientName }}
                        trigger={<Button size="sm" className="rounded-full">Schedule</Button>}
                      />
                      <RequestDecline request={r} patientName={patientName} />
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
