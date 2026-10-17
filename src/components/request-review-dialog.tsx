'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { RequestDecline } from '@/components/request-decline';
import { formatRequestOption, type AppointmentRequestView } from '@/lib/appointment-requests';
import { clinicNow, hhmmTo12h, type NoSlotReason } from '@/lib/doctor-availability';
import { specialtiesFor } from '@/lib/appointment-types';
import type { DoctorRecord } from '@/lib/get-doctors';

const REASON_TEXT: Record<NoSlotReason, string> = {
  no_schedule: 'This doctor has no working hours set yet.',
  not_working_day: "This doctor doesn't work on that day.",
  fully_booked: 'This doctor has no free time left on that day.',
  no_overlap: "This doctor's free times on that day don't fall inside the patient's preferred window.",
};

function formatDay(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

type SlotsState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; slots: string[]; reason: NoSlotReason | null }
  | { kind: 'error' };

/**
 * One appointment request: every detail, and for a pending one, Schedule
 * (only the free slots from /api/doctors/available-slots for the chosen
 * doctor and one of the patient's preferred dates) or Decline.
 */
export function RequestReviewDialog({
  request,
  patientName,
  doctors,
  scheduledDoctor,
  open,
  onOpenChange,
}: {
  request: AppointmentRequestView;
  patientName: string;
  doctors: DoctorRecord[];
  /** For a scheduled request: the doctor on its appointment, if known. */
  scheduledDoctor?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const pending = request.status === 'pending';

  const eligibleDoctors = useMemo(() => {
    const specialties = specialtiesFor(request.type);
    return doctors.filter((d) => specialties.includes(d.specialty));
  }, [doctors, request.type]);

  // The patient's preferred dates that haven't passed yet.
  const dates = useMemo(() => {
    const today = clinicNow(new Date()).date;
    return [...new Set(request.options.map((o) => o.date))].filter((d) => d >= today).sort();
  }, [request.options]);

  const [doctorId, setDoctorId] = useState('');
  const [date, setDate] = useState(dates[0] ?? '');
  const [slot, setSlot] = useState('');
  const [location, setLocation] = useState('');
  const [slots, setSlots] = useState<SlotsState>({ kind: 'idle' });
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Recalculate whenever the doctor or date changes (or after a 409).
  useEffect(() => {
    if (!open || !pending || !doctorId || !date) return;
    let cancelled = false;
    const q = new URLSearchParams({ doctorId, date, patientUid: request.patientUid, requestId: request.id });
    fetch(`/api/doctors/available-slots?${q}`, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { slots: string[]; reason: NoSlotReason | null };
        if (!cancelled) setSlots({ kind: 'ready', slots: data.slots, reason: data.reason });
      })
      .catch(() => !cancelled && setSlots({ kind: 'error' }));
    return () => {
      cancelled = true;
    };
  }, [open, pending, doctorId, date, request.patientUid, request.id, reloadKey]);

  function chooseDoctor(id: string) {
    setDoctorId(id);
    setSlot('');
    setError('');
    setSlots({ kind: 'loading' });
  }

  function chooseDate(d: string) {
    setDate(d);
    setSlot('');
    setError('');
    if (doctorId) setSlots({ kind: 'loading' });
  }

  async function schedule() {
    const doctor = doctors.find((d) => d.id === doctorId);
    if (!doctor || !date || !slot || saving) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientUid: request.patientUid,
          requestId: request.id,
          doctorId: doctor.id,
          doctor: doctor.name,
          label: request.type,
          type: doctor.specialty,
          date,
          time: hhmmTo12h(slot),
          location: location.trim() || undefined,
          notes: request.reason || undefined,
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (res.status === 409) {
        // Someone else took the time (or the request was just handled):
        // show it, reload the free times and the lists.
        setError(`${data?.error ?? 'That time was just booked'}. The available times have been refreshed.`);
        setSlot('');
        setSlots({ kind: 'loading' });
        setReloadKey((k) => k + 1);
        router.refresh();
        return;
      }
      if (!res.ok) {
        setError(data?.error ?? 'Could not schedule the appointment. Please try again.');
        return;
      }
      toast.success(`Scheduled for ${formatDay(date)} at ${hhmmTo12h(slot)}. The patient has been notified.`);
      onOpenChange(false);
      router.refresh();
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto p-5 sm:max-w-lg sm:p-6">
        <DialogHeader>
          <DialogTitle>{request.type} request</DialogTitle>
          <DialogDescription>
            {patientName}
            {request.createdAt > 0 &&
              ` · sent ${new Date(request.createdAt).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`}
          </DialogDescription>
        </DialogHeader>

        <dl className="space-y-2 rounded-xl border p-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Preferred time{request.options.length === 1 ? '' : 's'}</dt>
            <dd>
              <ul>
                {request.options.map((o) => (
                  <li key={`${o.date}-${o.from}`}>{formatRequestOption(o)}</li>
                ))}
              </ul>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Reason</dt>
            <dd className="break-words">{request.reason || '—'}</dd>
          </div>
          {request.notes && (
            <div>
              <dt className="text-xs text-muted-foreground">Patient&apos;s notes</dt>
              <dd className="break-words">{request.notes}</dd>
            </div>
          )}
          {request.status === 'declined' && (
            <div>
              <dt className="text-xs text-muted-foreground">Note to patient</dt>
              <dd className="break-words">{request.adminNote || '—'}</dd>
            </div>
          )}
          {request.status === 'scheduled' && (
            <div>
              <dt className="text-xs text-muted-foreground">Scheduled with</dt>
              <dd>{scheduledDoctor || '—'}</dd>
            </div>
          )}
        </dl>

        {pending && (
          <section className="space-y-3" aria-labelledby="schedule-heading">
            <h3 id="schedule-heading" className="text-sm font-semibold">Schedule</h3>

            <div className="space-y-1.5">
              <label htmlFor="schedule-doctor" className="text-sm font-medium">Doctor</label>
              <Select value={doctorId} onValueChange={(v) => v && chooseDoctor(v)}>
                <SelectTrigger id="schedule-doctor" className="w-full rounded-xl">
                  <SelectValue placeholder="Choose a doctor…">
                    {doctors.find((d) => d.id === doctorId)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {eligibleDoctors.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">No doctor handles this appointment type yet.</div>
                  ) : (
                    eligibleDoctors.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name} — {d.specialty}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <fieldset className="space-y-1.5">
              <legend className="text-sm font-medium">Date (patient&apos;s preferred)</legend>
              {dates.length === 0 ? (
                <p className="text-sm text-muted-foreground">All of the patient&apos;s preferred dates have passed. Decline with a note asking her to send a new request.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {dates.map((d) => (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={date === d}
                      onClick={() => chooseDate(d)}
                      className={`h-9 rounded-full border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                        date === d ? 'border-primary bg-primary text-primary-foreground' : 'border-input hover:bg-muted'
                      }`}
                    >
                      {formatDay(d)}
                    </button>
                  ))}
                </div>
              )}
            </fieldset>

            {doctorId && date && (
              <div className="space-y-1.5" aria-live="polite">
                <p className="text-sm font-medium">Free time</p>
                {slots.kind === 'loading' || slots.kind === 'idle' ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Checking the doctor&apos;s schedule…
                  </p>
                ) : slots.kind === 'error' ? (
                  <p className="text-sm text-red-700 dark:text-red-300">
                    Couldn&apos;t load the doctor&apos;s free times.{' '}
                    <button type="button" className="underline" onClick={() => { setSlots({ kind: 'loading' }); setReloadKey((k) => k + 1); }}>
                      Try again
                    </button>
                  </p>
                ) : slots.slots.length === 0 ? (
                  <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                    {slots.reason ? REASON_TEXT[slots.reason] : 'No free time.'} Try another doctor or date.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {slots.slots.map((s) => (
                      <button
                        key={s}
                        type="button"
                        aria-pressed={slot === s}
                        onClick={() => setSlot(s)}
                        className={`rounded-xl border px-2 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                          slot === s ? 'border-primary bg-primary text-primary-foreground' : 'border-input hover:bg-muted'
                        }`}
                      >
                        {hhmmTo12h(s)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {slot && (
              <div className="space-y-1.5">
                <label htmlFor="schedule-location" className="text-sm font-medium">Location (optional)</label>
                <Input
                  id="schedule-location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. MomCare Clinic, Room 3"
                  className="rounded-xl"
                />
              </div>
            )}

            {error && (
              <p role="alert" className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
                {error}
              </p>
            )}

            <div className="flex flex-col-reverse gap-2 border-t pt-3 sm:flex-row sm:justify-between">
              <RequestDecline request={request} patientName={patientName} onDeclined={() => onOpenChange(false)} />
              <Button type="button" className="rounded-full" disabled={!slot || saving} onClick={schedule} aria-busy={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    Scheduling…
                  </>
                ) : slot ? (
                  `Schedule ${formatDay(date)}, ${hhmmTo12h(slot)}`
                ) : (
                  'Choose a time'
                )}
              </Button>
            </div>
          </section>
        )}
      </DialogContent>
    </Dialog>
  );
}
