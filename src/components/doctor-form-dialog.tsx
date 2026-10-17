'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { DoctorRecord } from '@/lib/get-doctors';
import { getApiErrorMessage } from '@/lib/error-messages';
import {
  DoctorScheduleFields,
  validateSchedule,
  type ScheduleErrors,
  type ScheduleFields,
} from '@/components/doctor-schedule-fields';

function fromRecord(d: DoctorRecord): ScheduleFields {
  return {
    name: d.name ?? '',
    specialty: d.specialty ?? '',
    workingDays: [...(d.workingDays ?? [])].sort((a, b) => a - b),
    startTime: d.startTime ?? '',
    endTime: d.endTime ?? '',
    slotMinutes: typeof d.slotMinutes === 'number' ? d.slotMinutes : NaN,
  };
}

function sameSchedule(a: ScheduleFields, b: ScheduleFields): boolean {
  return (
    a.specialty === b.specialty &&
    a.startTime === b.startTime &&
    a.endTime === b.endTime &&
    (a.slotMinutes === b.slotMinutes || (Number.isNaN(a.slotMinutes) && Number.isNaN(b.slotMinutes))) &&
    a.workingDays.length === b.workingDays.length &&
    a.workingDays.every((d, i) => d === b.workingDays[i])
  );
}

/**
 * Edit Doctor: the same schedule controls as Add Doctor Account,
 * prefilled from the saved record and saved with a PATCH to that same
 * doctors/{id} document (it never creates an account). The name stays
 * locked (the server refuses a change too); login details are shown
 * read-only and there is no password field.
 */
export function DoctorFormDialog({
  editing,
  trigger,
}: {
  editing: DoctorRecord;
  trigger: React.ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ScheduleFields>(() => fromRecord(editing));
  const [initial, setInitial] = useState<ScheduleFields>(() => fromRecord(editing));
  const [submitted, setSubmitted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const inFlight = useRef(false);

  const dirty = !sameSchedule(form, initial);
  const errors: ScheduleErrors = submitted ? validateSchedule(form) : {};

  function handleOpenChange(next: boolean) {
    if (next) {
      // Prefill from the latest saved record every time it opens.
      const saved = fromRecord(editing);
      setForm(saved);
      setInitial(saved);
      setSubmitted(false);
      setError('');
      setOpen(true);
      return;
    }
    if (inFlight.current) return;
    if (dirty) {
      setConfirmDiscard(true);
      return;
    }
    setOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (inFlight.current) return;
    setSubmitted(true);
    setError('');
    if (Object.keys(validateSchedule(form)).length > 0) {
      setError('Please fix the highlighted fields.');
      return;
    }
    if (!dirty) {
      setOpen(false);
      return;
    }

    inFlight.current = true;
    setIsSaving(true);
    try {
      // Same document, same fields as before: the stored name is sent
      // unchanged (the route checks it), and no username or password.
      const res = await fetch(`/api/doctors/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editing.name,
          specialty: form.specialty,
          workingDays: form.workingDays,
          startTime: form.startTime,
          endTime: form.endTime,
          slotMinutes: form.slotMinutes,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(getApiErrorMessage(res, data, undefined, 'save doctor').description);
        return;
      }

      toast.success('Doctor updated.');
      setInitial(form);
      inFlight.current = false;
      setOpen(false);
      router.refresh();
    } catch (err: unknown) {
      setError(getApiErrorMessage(null, null, err, 'save doctor').description);
    } finally {
      inFlight.current = false;
      setIsSaving(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger render={trigger} />
        <DialogContent className="max-h-[92vh] overflow-y-auto p-5 sm:max-w-3xl sm:p-6">
          <DialogHeader>
            <DialogTitle>Edit Doctor</DialogTitle>
            <DialogDescription className="truncate">{editing.name}</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <fieldset disabled={isSaving} className="grid gap-5 md:grid-cols-2">
              <section className="space-y-4 rounded-2xl border p-4" aria-labelledby="edit-doctor-details">
                <h3 id="edit-doctor-details" className="text-sm font-semibold">Doctor Details</h3>
                <DoctorScheduleFields
                  idPrefix={`edit-doctor-${editing.id}`}
                  value={form}
                  onChange={setForm}
                  errors={errors}
                  nameLocked
                />
              </section>

              <section className="space-y-3 rounded-2xl border p-4 md:self-start" aria-labelledby="edit-doctor-login">
                <h3 id="edit-doctor-login" className="text-sm font-semibold">Login Credentials</h3>
                <dl className="space-y-3 text-sm">
                  <div className="space-y-0.5">
                    <dt className="text-muted-foreground">Username</dt>
                    <dd className="break-all font-medium">{editing.username || 'Not set'}</dd>
                  </div>
                  <div className="space-y-0.5">
                    <dt className="text-muted-foreground">Email</dt>
                    <dd className="break-all font-medium">{editing.loginEmail || 'Not set'}</dd>
                  </div>
                </dl>
                <p className="text-xs text-muted-foreground">
                  Login details can&apos;t be edited here, and passwords are never shown. Use the Login
                  button in the doctors list to manage access.
                </p>
              </section>
            </fieldset>

            <div aria-live="polite">
              {error && (
                <p className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
                  {error}
                </p>
              )}
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-full"
                disabled={isSaving}
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" className="h-10 rounded-full sm:min-w-40" disabled={isSaving} aria-busy={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    Saving…
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Your changes to {editing.name}&apos;s schedule haven&apos;t been saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive-solid"
              onClick={() => {
                setConfirmDiscard(false);
                setOpen(false);
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
