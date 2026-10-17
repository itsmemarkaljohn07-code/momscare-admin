'use client';

import { useMemo, useState } from 'react';
import { Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/empty-state';
import { RequestReviewDialog } from '@/components/request-review-dialog';
import {
  formatRequestOption,
  type AppointmentRequestStatus,
  type AppointmentRequestView,
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

const HEAD = 'text-xs font-semibold uppercase tracking-wide text-muted-foreground';

type Filter = 'pending' | 'all';

function submitted(ms: number): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function StatusBadge({ status }: { status: AppointmentRequestStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ color: s.color, backgroundColor: s.bg }}>
      {s.label}
    </span>
  );
}

/** Patients' appointment requests (kept live by the parent), as a compact
 *  table; a row opens the review dialog with Schedule / Decline. */
export function AppointmentRequestsTable({
  requests,
  loaded,
  users,
  doctors,
  appointments,
}: {
  requests: AppointmentRequestView[];
  loaded: boolean;
  users: AdminUserView[];
  doctors: DoctorRecord[];
  appointments: AdminAppointment[];
}) {
  const [filter, setFilter] = useState<Filter>('pending');
  const [openKey, setOpenKey] = useState<string | null>(null);

  const names = useMemo(() => new Map(users.map((u) => [u.uid, u.fullName])), [users]);
  const doctorOf = useMemo(() => new Map(appointments.map((a) => [`${a.patientUid}/${a.id}`, a.doctor])), [appointments]);
  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const shown = filter === 'pending' ? requests.filter((r) => r.status === 'pending') : requests;
  const keyOf = (r: AppointmentRequestView) => `${r.patientUid}/${r.id}`;
  const selected = requests.find((r) => keyOf(r) === openKey) ?? null;
  const doctorFor = (r: AppointmentRequestView) =>
    r.status === 'scheduled' && r.appointmentId ? doctorOf.get(`${r.patientUid}/${r.appointmentId}`) ?? null : null;

  return (
    <div className="space-y-4">
      <div className="flex gap-2" role="group" aria-label="Show requests">
        <Button size="sm" variant={filter === 'pending' ? 'default' : 'outline'} className="rounded-full" aria-pressed={filter === 'pending'} onClick={() => setFilter('pending')}>
          Pending ({pendingCount})
        </Button>
        <Button size="sm" variant={filter === 'all' ? 'default' : 'outline'} className="rounded-full" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
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
        <>
          <div className="hidden overflow-x-auto rounded-2xl border shadow-soft md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className={HEAD}>Patient</TableHead>
                  <TableHead className={HEAD}>Type</TableHead>
                  <TableHead className={HEAD}>Preferred</TableHead>
                  <TableHead className={HEAD}>Doctor</TableHead>
                  <TableHead className={HEAD}>Status</TableHead>
                  <TableHead className={HEAD}>Submitted</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((r) => (
                  <TableRow key={keyOf(r)} className="align-top transition-colors hover:bg-muted/50">
                    <TableCell className="max-w-48 truncate font-medium" title={names.get(r.patientUid)}>
                      {names.get(r.patientUid) ?? 'Unknown patient'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      <span aria-hidden="true">{r.icon} </span>
                      {r.type}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.options.map((o) => (
                        <p key={`${o.date}-${o.from}`} className="whitespace-nowrap">{formatRequestOption(o)}</p>
                      ))}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{doctorFor(r) ?? '—'}</TableCell>
                    <TableCell><StatusBadge status={r.status} /></TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{submitted(r.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant={r.status === 'pending' ? 'default' : 'outline'} className="rounded-full" onClick={() => setOpenKey(keyOf(r))}>
                        {r.status === 'pending' ? 'Review' : 'View'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className="grid gap-3 md:hidden">
            {shown.map((r) => (
              <li key={keyOf(r)}>
                <Card className="rounded-2xl shadow-soft">
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 truncate font-medium">{names.get(r.patientUid) ?? 'Unknown patient'}</p>
                      <StatusBadge status={r.status} />
                    </div>
                    <p className="text-sm"><span aria-hidden="true">{r.icon} </span>{r.type}</p>
                    <div className="text-xs text-muted-foreground">
                      {r.options.map((o) => <p key={`${o.date}-${o.from}`}>{formatRequestOption(o)}</p>)}
                      {doctorFor(r) && <p>With {doctorFor(r)}</p>}
                      <p>Sent {submitted(r.createdAt)}</p>
                    </div>
                    <Button size="sm" variant={r.status === 'pending' ? 'default' : 'outline'} className="w-full rounded-full" onClick={() => setOpenKey(keyOf(r))}>
                      {r.status === 'pending' ? 'Review' : 'View'}
                    </Button>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}

      {selected && (
        <RequestReviewDialog
          key={openKey ?? ''}
          request={selected}
          patientName={names.get(selected.patientUid) ?? 'Unknown patient'}
          doctors={doctors}
          scheduledDoctor={doctorFor(selected)}
          open={openKey !== null}
          onOpenChange={(o) => !o && setOpenKey(null)}
        />
      )}
    </div>
  );
}
