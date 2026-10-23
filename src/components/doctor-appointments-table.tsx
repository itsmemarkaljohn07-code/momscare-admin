'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CalendarX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { AppointmentStatus, StatusBadge } from '@/components/status-badge';
import { EmptyState } from '@/components/empty-state';
import { DecidedByAdminNote } from '@/components/admin-approval-controls';
import { isPendingDoctorApproval } from '@/lib/appointment-status';
import { formatDateKey } from '@/lib/pregnancy-display';
import { showApiError } from '@/lib/error-messages';
import type { DoctorAppointmentView } from '@/lib/get-doctor-appointments';
import { LoadMoreButton } from '@/components/load-more';
import { useLoadMore } from '@/hooks/use-load-more';

const HEAD = 'text-xs font-semibold uppercase tracking-wide text-muted-foreground';

function dateLabel(date: string): string {
  return formatDateKey(date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export function DoctorAppointmentsTable({ appointments }: { appointments: DoctorAppointmentView[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [rejectingAppt, setRejectingAppt] = useState<DoctorAppointmentView | null>(null);
  const [reason, setReason] = useState('');
  // 20 rows at a time (the list has no search or filter of its own).
  const page = useLoadMore(appointments, 20);

  async function updateApproval(appt: DoctorAppointmentView, doctorApproval: 'approved' | 'rejected', rejectionReason?: string) {
    setPendingId(appt.id);
    try {
      const res = await fetch(`/api/doctors/appointment/${appt.patientUid}/${appt.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctorApproval, rejectionReason }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        showApiError(res, data, undefined, 'doctor appointment approval');
        return;
      }
      toast.success(`Appointment ${doctorApproval === 'approved' ? 'approved' : 'declined'}.`);
      router.refresh();
    } catch (err) {
      showApiError(null, null, err, 'doctor appointment approval');
    } finally {
      setPendingId(null);
      setRejectingAppt(null);
      setReason('');
    }
  }

  /** Approve / Decline for a pending appointment (44px on phones). */
  function renderActions(a: DoctorAppointmentView, stretch = false) {
    if (!isPendingDoctorApproval(a)) return null;
    const size = `min-h-11 sm:min-h-8 ${stretch ? 'flex-1' : ''}`;
    return (
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="success"
          className={size}
          disabled={pendingId === a.id}
          onClick={() => updateApproval(a, 'approved')}
          aria-label={`Approve ${a.patientName}'s ${a.label} on ${dateLabel(a.date)}`}
        >
          Approve
        </Button>
        <Button
          size="sm"
          variant="destructive"
          className={size}
          disabled={pendingId === a.id}
          onClick={() => setRejectingAppt(a)}
          aria-label={`Decline ${a.patientName}'s ${a.label} on ${dateLabel(a.date)}`}
        >
          Decline
        </Button>
      </div>
    );
  }

  function renderApproval(a: DoctorAppointmentView) {
    return (
      <div className="space-y-1">
        <StatusBadge status={a.doctorApproval} />
        {a.doctorApproval !== 'pending' && a.decidedBy === 'admin' && <DecidedByAdminNote />}
        {a.doctorApproval === 'rejected' && a.rejectionReason && (
          <p
            className="line-clamp-2 max-w-[220px] whitespace-normal break-words text-xs text-muted-foreground"
            title={a.rejectionReason}
          >
            {a.rejectionReason}
          </p>
        )}
      </div>
    );
  }

  if (appointments.length === 0) {
    return (
      <EmptyState
        icon={CalendarX}
        title="No appointments yet"
        description="Appointments booked with you appear here."
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* 640px and up */}
      <div className="hidden overflow-x-auto rounded-2xl border shadow-soft sm:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className={HEAD}>Patient</TableHead>
              <TableHead className={HEAD}>Appointment</TableHead>
              <TableHead className={HEAD}>Date</TableHead>
              <TableHead className={HEAD}>Time</TableHead>
              <TableHead className={HEAD}>Status</TableHead>
              <TableHead className={HEAD}>Approval</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {page.visible.map((a) => (
              <TableRow key={a.id} className="align-top">
                <TableCell className="max-w-48 truncate font-medium" title={a.patientName}>{a.patientName}</TableCell>
                <TableCell className="whitespace-normal">
                  {a.label} <span className="text-xs text-muted-foreground">({a.type})</span>
                </TableCell>
                <TableCell className="whitespace-nowrap">{dateLabel(a.date)}</TableCell>
                <TableCell className="whitespace-nowrap">{a.time}</TableCell>
                <TableCell>
                  <AppointmentStatus appointment={a} />
                </TableCell>
                <TableCell>
                  {renderApproval(a)}
                </TableCell>
                <TableCell>
                  {renderActions(a)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Under 640px */}
      <ul className="space-y-3 sm:hidden">
        {page.visible.map((a) => (
          <li key={a.id}>
            <Card className="rounded-2xl shadow-soft">
              <CardContent className="space-y-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium" title={a.patientName}>{a.patientName}</p>
                  <p className="text-sm text-muted-foreground">
                    {a.label} <span className="text-xs">({a.type})</span>
                  </p>
                  <p className="text-sm">{dateLabel(a.date)} · {a.time}</p>
                </div>
                <div className="flex flex-wrap items-start gap-2">
                  <AppointmentStatus appointment={a} />
                  {renderApproval(a)}
                </div>
                {renderActions(a, true)}
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>

      <LoadMoreButton hasMore={page.hasMore} onClick={page.loadMore} shown={page.shown} total={page.total} />

      {/* One decline dialog for whichever appointment is being declined. */}
      <Dialog open={rejectingAppt !== null} onOpenChange={(open) => !open && pendingId === null && setRejectingAppt(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Decline Appointment</DialogTitle>
            {rejectingAppt && (
              <DialogDescription>
                {rejectingAppt.patientName}&apos;s {rejectingAppt.label} on {dateLabel(rejectingAppt.date)} at {rejectingAppt.time}.
              </DialogDescription>
            )}
          </DialogHeader>
          <label htmlFor="decline-reason" className="sr-only">Reason for the patient (optional)</label>
          <Textarea
            id="decline-reason"
            placeholder="Reason for the patient (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
          />
          <Button
            variant="destructive"
            className="min-h-11 w-full"
            disabled={!rejectingAppt || pendingId === rejectingAppt.id}
            onClick={() => rejectingAppt && updateApproval(rejectingAppt, 'rejected', reason)}
          >
            Confirm Decline
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
