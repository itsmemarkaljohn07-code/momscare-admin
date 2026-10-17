'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { showApiError } from '@/lib/error-messages';
import { ADMIN_NOTE_MAX, type AppointmentRequestView } from '@/lib/appointment-requests';

/** "Decline" for a pending appointment request, with an optional note the
 *  patient sees in the app. The list updates itself (live listener). */
export function RequestDecline({
  request,
  patientName,
}: {
  request: AppointmentRequestView;
  patientName: string;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleDecline() {
    setBusy(true);
    try {
      const res = await fetch(`/api/appointment-requests/${request.patientUid}/${request.id}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: note.trim() || undefined }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        showApiError(res, data, undefined, 'decline appointment request');
        return;
      }
      toast.success('Request declined. The patient has been notified.');
      setOpen(false);
      setNote('');
    } catch (err) {
      showApiError(null, null, err, 'decline appointment request');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" className="rounded-full" disabled={busy} onClick={() => setOpen(true)}>
        Decline
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          // Don't close mid-request; the result decides.
          if (!busy) setOpen(next);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Decline appointment request</DialogTitle>
            <DialogDescription>
              {patientName}&apos;s {request.type} request will be declined and the patient will be notified.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Textarea
              placeholder="Note for the patient (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={ADMIN_NOTE_MAX}
              rows={3}
              disabled={busy}
            />
            <p className="text-right text-xs text-muted-foreground">
              {note.length}/{ADMIN_NOTE_MAX}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>
              Back
            </Button>
            <Button variant="destructive" disabled={busy} onClick={handleDecline}>
              {busy ? 'Declining…' : 'Decline request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
