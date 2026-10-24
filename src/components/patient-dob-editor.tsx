'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Cake, Loader2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ageOn, validateDob } from '@/lib/date-of-birth';
import { manilaKey } from '@/lib/report-aggregations';
import { formatDateKey } from '@/lib/pregnancy-display';
import { showApiError } from '@/lib/error-messages';

/** The patient view's "Date of birth" row: value and age today, and an
 *  admin-only Edit dialog that saves through the server (validated there
 *  again). The profile listener shows the saved value. */
export function PatientDobRow({ uid, patientName, dob }: { uid: string; patientName: string; dob: string | null }) {
  const today = manilaKey(new Date());
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(dob ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const age = dob ? ageOn(dob, today) : null;
  const shown = dob ? `${formatDateKey(dob, { month: 'short', day: 'numeric', year: 'numeric' })}${age !== null ? ` (age ${age})` : ''}` : null;

  function openEditor() {
    setValue(dob ?? '');
    setError('');
    setOpen(true);
  }

  async function save(next: string | null) {
    if (busy) return;
    if (next !== null) {
      const checked = validateDob(next, today);
      if (!checked.ok) {
        setError(checked.error);
        return;
      }
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(uid)}/dob`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dob: next }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 400) {
        setError(data?.error ?? 'Check the date and try again.');
        return;
      }
      if (!res.ok) {
        showApiError(res, data, undefined, 'save date of birth');
        return;
      }
      toast.success(next === null ? 'Date of birth removed.' : 'Date of birth saved.');
      setOpen(false);
    } catch (err) {
      showApiError(null, null, err, 'save date of birth');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 border-b py-2.5 text-sm last:border-b-0">
      <dt className="flex shrink-0 items-center gap-2 text-muted-foreground">
        <Cake className="h-4 w-4" aria-hidden="true" />
        Date of birth
      </dt>
      <dd className="flex min-w-0 items-center gap-1">
        <span className={`truncate text-right ${shown ? 'font-medium' : 'italic text-muted-foreground'}`} title={shown ?? undefined}>
          {shown ?? 'Not set'}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-11 shrink-0 md:size-8"
          onClick={openEditor}
          aria-label={`Edit ${patientName}'s date of birth`}
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </dd>

      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Date of birth</DialogTitle>
            <DialogDescription>
              {patientName}. Used for age groups in reports. The patient&apos;s age must be between 10 and 60 today.
            </DialogDescription>
          </DialogHeader>
          <label className="grid gap-1.5 text-sm font-medium">
            Date of birth
            <Input
              type="date"
              value={value}
              max={today}
              onChange={(e) => { setValue(e.target.value); setError(''); }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'dob-error' : undefined}
              className="h-11 md:h-9"
            />
          </label>
          <div aria-live="polite">
            {error && <p id="dob-error" role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          </div>
          <DialogFooter>
            {dob && (
              <Button type="button" variant="ghost" className="min-h-11 md:min-h-9 sm:mr-auto" disabled={busy} onClick={() => save(null)}>
                Remove
              </Button>
            )}
            <Button type="button" variant="outline" className="min-h-11 md:min-h-9" disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" className="min-h-11 gap-2 md:min-h-9" disabled={busy || !value} aria-busy={busy} onClick={() => save(value)}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
