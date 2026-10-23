'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { appointmentName } from '@/lib/appointment-status';
import { DECLINE_REASON_MAX } from '@/lib/appointment-decision-rules';
import { formatDateKey } from '@/lib/pregnancy-display';
import { showApiError } from '@/lib/error-messages';
import type { AdminAppointment } from '@/lib/get-appointments';

const CONFIRM_LINE = 'Only do this after confirming with the doctor.';

function dateLabel(date: string): string {
  return formatDateKey(date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Approve / Decline for an appointment still waiting for the doctor: the
 * clinic's backup when the doctor can't open her dashboard. Each opens a
 * confirm dialog; the request goes to the admin approval route, which
 * refuses (409) anything already decided or no longer upcoming.
 */
export function AdminApprovalControls({ appointment: a, stretch = false }: { appointment: AdminAppointment; stretch?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState<'approve' | 'decline' | null>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');

  const name = appointmentName(a.label);
  const when = `${dateLabel(a.date)} at ${a.time}`;

  async function submit(decision: 'approve' | 'decline') {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/appointments/${a.patientUid}/${a.id}/approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(decision === 'decline' ? { decision, reason } : { decision }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 409) {
        // Someone (the doctor, another admin, the clock) got there first.
        toast.error('Not changed', { description: data?.error ?? 'This appointment can no longer be approved or declined.' });
        setOpen(null);
        router.refresh();
        return;
      }
      if (!res.ok) {
        showApiError(res, data, undefined, 'admin appointment approval');
        return;
      }
      toast.success(decision === 'approve' ? `Approved on behalf of ${a.doctor}.` : `Declined on behalf of ${a.doctor}.`);
      setOpen(null);
      setReason('');
      router.refresh();
    } catch (err) {
      showApiError(null, null, err, 'admin appointment approval');
    } finally {
      setBusy(false);
    }
  }

  const size = `min-h-11 md:min-h-8 ${stretch ? 'flex-1' : ''}`;

  return (
    <>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="success"
          className={size}
          disabled={busy}
          onClick={() => setOpen('approve')}
          aria-label={`Approve ${a.patientName}'s ${a.label} on ${dateLabel(a.date)} for ${a.doctor}`}
        >
          Approve
        </Button>
        <Button
          size="sm"
          variant="destructive"
          className={size}
          disabled={busy}
          onClick={() => setOpen('decline')}
          aria-label={`Decline ${a.patientName}'s ${a.label} on ${dateLabel(a.date)} for ${a.doctor}`}
        >
          Decline
        </Button>
      </div>

      <Dialog open={open === 'approve'} onOpenChange={(o) => !o && !busy && setOpen(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Approve appointment?</DialogTitle>
            <DialogDescription>
              Approve {name} for {a.patientName} on {when} with {a.doctor}? {CONFIRM_LINE}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="min-h-11 md:min-h-9" disabled={busy} onClick={() => setOpen(null)}>
              Cancel
            </Button>
            <Button variant="success" className="min-h-11 gap-2 md:min-h-9" disabled={busy} aria-busy={busy} onClick={() => submit('approve')}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open === 'decline'} onOpenChange={(o) => !o && !busy && setOpen(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Decline Appointment</DialogTitle>
            <DialogDescription>
              {a.patientName}&apos;s {a.label} on {when} with {a.doctor}. {CONFIRM_LINE}
            </DialogDescription>
          </DialogHeader>
          <label htmlFor={`admin-decline-reason-${a.id}`} className="sr-only">Reason for the patient (optional)</label>
          <Textarea
            id={`admin-decline-reason-${a.id}`}
            placeholder="Reason for the patient (optional)"
            value={reason}
            maxLength={DECLINE_REASON_MAX}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" className="min-h-11 md:min-h-9" disabled={busy} onClick={() => setOpen(null)}>
              Cancel
            </Button>
            <Button variant="destructive-solid" className="min-h-11 gap-2 md:min-h-9" disabled={busy} aria-busy={busy} onClick={() => submit('decline')}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Confirm Decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** "by admin" under an Approved / Declined badge the clinic recorded. */
export function DecidedByAdminNote() {
  return (
    <span className="mt-1 block text-[11px] leading-tight text-muted-foreground" title="Recorded by the clinic on the doctor's behalf">
      by admin
    </span>
  );
}
