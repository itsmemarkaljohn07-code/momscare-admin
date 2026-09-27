'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { StatusBadge } from '@/components/status-badge';
import { computeDisplayStatus } from '@/lib/appointment-status';
import { showApiError } from '@/lib/error-messages';
import type { DoctorAppointmentView } from '@/lib/get-doctor-appointments';

export function DoctorAppointmentsTable({ appointments }: { appointments: DoctorAppointmentView[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [rejectingAppt, setRejectingAppt] = useState<DoctorAppointmentView | null>(null);
  const [reason, setReason] = useState('');

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

  return (
    <div className="overflow-x-auto rounded-2xl border shadow-soft">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Patient</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Appointment</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Time</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Approval</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {appointments.map((a) => {
            const displayStatus = computeDisplayStatus(a.date, a.time, a.status);
            return (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.patientName}</TableCell>
                <TableCell>{a.label} <span className="text-xs text-muted-foreground">({a.type})</span></TableCell>
                <TableCell>{a.date}</TableCell>
                <TableCell>{a.time}</TableCell>
                <TableCell>
                  <StatusBadge status={displayStatus} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={a.doctorApproval} />
                  {a.doctorApproval === 'rejected' && a.rejectionReason && (
                    <p
                      className="mt-1 line-clamp-2 max-w-[200px] whitespace-normal break-words text-xs text-muted-foreground"
                      title={a.rejectionReason}
                    >
                      {a.rejectionReason}
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  {a.doctorApproval === 'pending' && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={pendingId === a.id}
                        onClick={() => updateApproval(a, 'approved')}
                      >
                        Approve
                      </Button>
                      <Dialog open={rejectingAppt?.id === a.id} onOpenChange={(open) => !open && setRejectingAppt(null)}>
                        <DialogTrigger render={<Button size="sm" variant="destructive" onClick={() => setRejectingAppt(a)} />}>
                          Decline
                        </DialogTrigger>
                        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-sm">
                          <DialogHeader><DialogTitle>Decline Appointment</DialogTitle></DialogHeader>
                          <Textarea
                            placeholder="Reason for the patient (optional)"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows={3}
                          />
                          <Button
                            variant="destructive"
                            className="w-full"
                            disabled={pendingId === a.id}
                            onClick={() => updateApproval(a, 'rejected', reason)}
                          >
                            Confirm Decline
                          </Button>
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
          {appointments.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                No appointments yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}