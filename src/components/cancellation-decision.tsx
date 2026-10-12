'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { showApiError } from '@/lib/error-messages';
import { DECLINE_REASON_MAX } from '@/lib/appointment-cancellation';
import type { AdminAppointment } from '@/lib/get-appointments';

type Decision = 'approve' | 'decline';

/** Approve / Decline buttons for a patient's open cancellation request. */
export function CancellationDecision({ appointment }: { appointment: AdminAppointment }) {
  const router = useRouter();
  const [inFlight, setInFlight] = useState<Decision | null>(null);
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [reason, setReason] = useState('');

  const patientReason = appointment.cancellation?.reason;

  async function decide(decision: Decision, declineReason?: string): Promise<boolean> {
    setInFlight(decision);
    try {
      const res = await fetch(
        `/api/appointments/${appointment.patientUid}/${appointment.id}/cancellation`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ decision, reason: declineReason || undefined }),
        }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        showApiError(res, data, undefined, 'cancellation decision');
        return false;
      }
      toast.success(
        data?.message ??
          (decision === 'approve' ? 'Cancellation approved.' : 'Cancellation request declined.')
      );
      router.refresh();
      return true;
    } catch (err) {
      showApiError(null, null, err, 'cancellation decision');
      return false;
    } finally {
      setInFlight(null);
    }
  }

  async function handleDecline() {
    const ok = await decide('decline', reason.trim());
    if (ok) {
      setDeclineOpen(false);
      setReason('');
    }
  }

  const busy = inFlight !== null;

  return (
    <>
      <Button size="sm" disabled={busy} onClick={() => setConfirmApprove(true)}>
        {inFlight === 'approve' ? 'Approving…' : 'Approve cancellation'}
      </Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => setDeclineOpen(true)}>
        {inFlight === 'decline' ? 'Declining…' : 'Decline'}
      </Button>

      <AlertDialog open={confirmApprove} onOpenChange={setConfirmApprove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve cancellation?</AlertDialogTitle>
            <AlertDialogDescription>
              {appointment.patientName}&apos;s {appointment.label} appointment on {appointment.date} at{' '}
              {appointment.time} will be cancelled and the patient will be notified.
              {patientReason ? ` Reason given: “${patientReason}”` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep appointment</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={() => {
                setConfirmApprove(false);
                void decide('approve');
              }}
            >
              Approve cancellation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={declineOpen}
        onOpenChange={(open) => {
          // Don't close mid-request; the result decides.
          if (!busy) setDeclineOpen(open);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Decline cancellation request</DialogTitle>
            <DialogDescription>
              The appointment stays scheduled and {appointment.patientName} will be notified.
            </DialogDescription>
          </DialogHeader>
          {patientReason && (
            <p className="text-sm text-muted-foreground">
              Patient&apos;s reason: <span className="text-foreground">{patientReason}</span>
            </p>
          )}
          <div className="space-y-1">
            <Textarea
              placeholder="Reason for the patient (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={DECLINE_REASON_MAX}
              rows={3}
              disabled={busy}
            />
            <p className="text-right text-xs text-muted-foreground">
              {reason.length}/{DECLINE_REASON_MAX}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setDeclineOpen(false)}>
              Back
            </Button>
            <Button variant="destructive" disabled={busy} onClick={handleDecline}>
              {inFlight === 'decline' ? 'Declining…' : 'Decline request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
