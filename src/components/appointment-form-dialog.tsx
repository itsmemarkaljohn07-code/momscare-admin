'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { AdminUserView } from '@/lib/get-users';
import type { AdminAppointment } from '@/lib/get-appointments';
import type { DoctorRecord } from '@/lib/get-doctors';
import { formatRequestOption, type AppointmentRequestView } from '@/lib/appointment-requests';
import { NAME_TO_TYPES, isCustomSpecialty } from '@/lib/appointment-types';
import { clinicNow, hhmmTo12h, timeToMinutes, minutesToHHmm, type NoSlotReason } from '@/lib/doctor-availability';

// Names the admin can choose. "Booking Appointment" is no longer offered
// for new appointments; one that already has it keeps it (see nameOptions).
const NAME_OPTIONS = [
  'Prenatal Checkup', 'Nuchal Scan', 'Anomaly Scan',
  'Glucose Tolerance Test', 'Group B Strep Test', 'Ultrasound', 'Blood Test',
  'Postpartum Checkup', 'Other',
];

const REASON_TEXT: Record<NoSlotReason, string> = {
  no_schedule: "This doctor has no working hours set yet. Choose another doctor.",
  not_working_day: "This doctor doesn't work on that day. Choose another date.",
  fully_booked: 'This doctor has no free time left on that day. Choose another date.',
  no_overlap: 'No free time fits on that day. Choose another date.',
};

/** Touch-friendly control height: 44px on touch widths, 36px from md up. */
const FIELD = 'h-11 rounded-xl md:h-9';

function dateKeyToDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toLocalDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "9:00 AM" (as stored) -> "09:00"; '' when unreadable. */
function toHHmm(time: string): string {
  const m = timeToMinutes(time);
  return m === null ? '' : minutesToHHmm(m);
}

interface FormState {
  patientUid: string;
  label: string;
  type: string;
  /** Doctor's id (the stored appointment keeps the doctor's name). */
  doctorId: string;
  date: string;
  /** "HH:mm" */
  time: string;
  location: string;
  notes: string;
}

type Field = 'patient' | 'label' | 'type' | 'doctor' | 'date' | 'time';
type Errors = Partial<Record<Field, string>>;

const BLANK: FormState = {
  patientUid: '', label: '', type: '', doctorId: '', date: '', time: '', location: '', notes: '',
};

type SlotsState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; slots: string[]; reason: NoSlotReason | null }
  | { kind: 'error' };

function validate(f: FormState): Errors {
  const e: Errors = {};
  if (!f.patientUid) e.patient = 'Choose a patient from the list.';
  if (!f.label) e.label = 'Choose the appointment name.';
  if (!f.type) e.type = 'Choose a specialty.';
  if (!f.doctorId) e.doctor = 'Choose a doctor.';
  if (!f.date) e.date = 'Choose a date.';
  if (!f.time) e.time = 'Choose a free time.';
  return e;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <p id={id} className="text-xs text-red-600 dark:text-red-400">{message}</p>;
}

function Required() {
  return <span className="text-red-500" aria-hidden="true"> *</span>;
}

/**
 * New / Edit Appointment. Same fields and the same POST /api/appointments
 * (PATCH for an edit). Times come from GET /api/doctors/available-slots,
 * so only the doctor's free slots can be chosen; the server re-checks and
 * answers 409 if one was just taken.
 */
export function AppointmentFormDialog({
  users,
  doctors,
  editing,
  request,
  trigger,
}: {
  users: AdminUserView[];
  /** Kept for callers; free times now come from the server. */
  appointments?: AdminAppointment[];
  doctors: DoctorRecord[];
  editing?: AdminAppointment;
  /** Scheduling a patient's request: the form starts from it, shows her
   *  preferred times, and the create marks the request scheduled. */
  request?: AppointmentRequestView & { patientName: string };
  trigger: React.ReactElement;
}) {
  const router = useRouter();
  const uid = useId();
  const id = (k: string) => `${uid}-${k}`;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(BLANK);
  const [submitted, setSubmitted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);

  const [patientQuery, setPatientQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [slots, setSlots] = useState<SlotsState>({ kind: 'idle' });
  const [reloadKey, setReloadKey] = useState(0);

  const isSequential = !editing;
  const patientChosen = !!form.patientUid;
  const nameChosen = !!form.label;
  const typeChosen = !!form.type;
  const doctor = doctors.find((d) => d.id === form.doctorId) ?? null;

  const nameDisabled = isSequential && !patientChosen;
  const typeDisabled = isSequential ? !patientChosen || !nameChosen : !nameChosen;
  const doctorDisabled = isSequential ? !patientChosen || !nameChosen || !typeChosen : !typeChosen;

  // Editing an appointment whose name is no longer offered (e.g. "Booking
  // Appointment"): keep it selectable so it still shows and can be kept.
  const nameOptions =
    editing?.label && !NAME_OPTIONS.includes(editing.label) ? [...NAME_OPTIONS, editing.label] : NAME_OPTIONS;
  // "Other" appointments can also go to doctors with a typed-in specialty.
  const customSpecialties = [...new Set(doctors.map((d) => d.specialty).filter(isCustomSpecialty))].sort();
  const typesFor = (name: string) =>
    name === 'Other' ? [...(NAME_TO_TYPES.Other ?? []), ...customSpecialties] : (NAME_TO_TYPES[name] ?? []);
  const availableTypes = nameChosen ? typesFor(form.label) : [];
  const availableDoctors = typeChosen ? doctors.filter((d) => d.specialty === form.type) : [];

  const errors: Errors = submitted ? validate(form) : {};
  const todayKey = clinicNow(new Date()).date;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSuggestions(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Free times for the chosen doctor and date; refetched when either
  // changes, or after a 409.
  useEffect(() => {
    if (!open || !form.doctorId || !form.date) return;
    let cancelled = false;
    const q = new URLSearchParams({ doctorId: form.doctorId, date: form.date });
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
  }, [open, form.doctorId, form.date, reloadKey]);

  // Editing: the appointment's own time is free for itself, so keep it
  // selectable while its doctor and date are unchanged.
  const ownTime =
    editing && doctor?.name === editing.doctor && form.date === editing.date ? toHHmm(editing.time) : '';
  const shownSlots =
    slots.kind === 'ready'
      ? [...new Set([...slots.slots, ...(ownTime ? [ownTime] : [])])].sort()
      : [];

  // Reset the form once per open/editing transition — computed during
  // render (React's pattern for this) rather than setState in an effect.
  const [wasOpen, setWasOpen] = useState(open);
  const [prevEditingId, setPrevEditingId] = useState(editing?.id);
  if (open !== wasOpen || editing?.id !== prevEditingId) {
    setWasOpen(open);
    setPrevEditingId(editing?.id);
    if (open) {
      if (editing) {
        const d = doctors.find((x) => x.name === editing.doctor);
        setForm({
          patientUid: editing.patientUid,
          label: editing.label,
          type: editing.type,
          doctorId: d?.id ?? '',
          date: editing.date,
          time: toHHmm(editing.time),
          location: editing.location ?? '',
          notes: editing.notes ?? '',
        });
        setPatientQuery(editing.patientName);
        setSlots(d && editing.date ? { kind: 'loading' } : { kind: 'idle' });
      } else if (request) {
        setForm({
          ...BLANK,
          patientUid: request.patientUid,
          label: NAME_OPTIONS.includes(request.type) ? request.type : 'Other',
          notes: request.reason,
        });
        setPatientQuery(request.patientName);
        setSlots({ kind: 'idle' });
      } else {
        setForm(BLANK);
        setPatientQuery('');
        setSlots({ kind: 'idle' });
      }
      setSubmitted(false);
      setError('');
      setShowSuggestions(false);
    }
  }

  const filteredPatients = patientQuery.trim()
    ? users.filter((u) => u.fullName.toLowerCase().includes(patientQuery.trim().toLowerCase())).slice(0, 8)
    : [];

  function handlePatientInputChange(value: string) {
    setPatientQuery(value);
    setForm((f) => ({ ...f, patientUid: '' }));
    setShowSuggestions(true);
    setActiveIndex(0);
  }

  function selectPatient(u: AdminUserView) {
    setForm((f) => ({ ...f, patientUid: u.uid }));
    setPatientQuery(u.fullName);
    setShowSuggestions(false);
  }

  function handlePatientKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showSuggestions || filteredPatients.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % filteredPatients.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + filteredPatients.length) % filteredPatients.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      selectPatient(filteredPatients[Math.min(activeIndex, filteredPatients.length - 1)]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  }

  function handleNameChange(value: string) {
    const keepType = typesFor(value).includes(form.type);
    setForm((f) => ({ ...f, label: value, type: keepType ? f.type : '', doctorId: keepType ? f.doctorId : '', time: keepType ? f.time : '' }));
    if (!keepType) setSlots({ kind: 'idle' });
  }

  function handleTypeChange(value: string) {
    const doctorStillValid = doctors.some((d) => d.id === form.doctorId && d.specialty === value);
    setForm((f) => ({
      ...f,
      type: value,
      doctorId: doctorStillValid ? f.doctorId : '',
      date: doctorStillValid ? f.date : '',
      time: doctorStillValid ? f.time : '',
    }));
    if (!doctorStillValid) setSlots({ kind: 'idle' });
  }

  function handleDoctorChange(value: string) {
    setForm((f) => ({ ...f, doctorId: value, time: '' }));
    setSlots(form.date ? { kind: 'loading' } : { kind: 'idle' });
  }

  function handleDateChange(date: Date | undefined) {
    if (!date) return;
    setForm((f) => ({ ...f, date: toLocalDateKey(date), time: '' }));
    setSlots(form.doctorId ? { kind: 'loading' } : { kind: 'idle' });
    setCalendarOpen(false);
  }

  function dateDisabled(date: Date): boolean {
    if (toLocalDateKey(date) < todayKey) return true;
    return !!doctor && Array.isArray(doctor.workingDays) && doctor.workingDays.length > 0 && !doctor.workingDays.includes(date.getDay());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (inFlight.current) return;
    setSubmitted(true);
    setError('');
    if (Object.keys(validate(form)).length > 0 || !doctor) {
      setError('Please fix the highlighted fields.');
      return;
    }

    inFlight.current = true;
    setIsSaving(true);
    const payload = {
      label: form.label,
      type: form.type,
      doctor: doctor.name,
      date: form.date,
      time: hhmmTo12h(form.time),
      location: form.location.trim() || undefined,
      notes: form.notes.trim() || undefined,
    };

    try {
      const res = editing
        ? await fetch(`/api/appointments/${editing.patientUid}/${editing.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/appointments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              patientUid: form.patientUid,
              doctorId: doctor.id,
              ...(request ? { requestId: request.id } : {}),
              ...payload,
            }),
          });

      if (res.status === 409) {
        const data = await res.json().catch(() => ({}));
        setError(`${data.error || 'That time was just booked'}. The free times have been refreshed; choose another.`);
        setForm((f) => ({ ...f, time: '' }));
        setSlots({ kind: 'loading' });
        setReloadKey((k) => k + 1);
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Could not save the appointment. Please try again.');
        return;
      }

      toast.success(editing ? 'Appointment updated.' : 'Appointment created. The patient has been notified.');
      inFlight.current = false;
      setOpen(false);
      router.refresh();
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      inFlight.current = false;
      setIsSaving(false);
    }
  }

  const invalid = (k: Field) => (errors[k] ? { 'aria-invalid': true as const, 'aria-describedby': id(`${k}-error`) } : {});
  const doctorPicked = !!form.doctorId;

  return (
    <Dialog open={open} onOpenChange={(next) => !inFlight.current && setOpen(next)}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[92vh] overflow-y-auto p-5 sm:max-w-3xl sm:p-6">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Appointment' : 'New Appointment'}</DialogTitle>
          <DialogDescription>
            Fields marked <span className="text-red-500">*</span> are required. Only the doctor&apos;s free times are offered.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <fieldset disabled={isSaving} className="grid gap-5 md:grid-cols-2">
            {/* Left: who and what */}
            <div className="min-w-0 space-y-4">
              <div className="space-y-1.5" ref={searchRef}>
                <label htmlFor={id('patient')} className="text-sm font-medium">Patient<Required /></label>
                {editing || request ? (
                  <Input id={id('patient')} value={patientQuery} disabled className={FIELD} />
                ) : (
                  <div className="relative">
                    <Input
                      id={id('patient')}
                      role="combobox"
                      aria-expanded={showSuggestions && !!patientQuery.trim()}
                      aria-controls={id('patient-list')}
                      aria-autocomplete="list"
                      value={patientQuery}
                      onChange={(e) => handlePatientInputChange(e.target.value)}
                      onFocus={() => setShowSuggestions(true)}
                      onKeyDown={handlePatientKey}
                      placeholder="Search by patient name..."
                      autoComplete="off"
                      className={FIELD}
                      {...invalid('patient')}
                    />
                    {showSuggestions && patientQuery.trim() && (
                      <div className="absolute z-50 mt-1 w-full rounded-xl border bg-popover shadow-card">
                        {filteredPatients.length > 0 ? (
                          <ul id={id('patient-list')} role="listbox" className="max-h-56 overflow-y-auto py-1">
                            {filteredPatients.map((u, i) => (
                              <li key={u.uid} role="option" aria-selected={i === activeIndex}>
                                <button
                                  type="button"
                                  className={`flex min-h-11 w-full items-center px-3 text-left text-sm hover:bg-muted md:min-h-9 ${i === activeIndex ? 'bg-muted' : ''}`}
                                  onMouseEnter={() => setActiveIndex(i)}
                                  onClick={() => selectPatient(u)}
                                >
                                  <span className="truncate">{u.fullName}</span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="px-3 py-2 text-sm text-muted-foreground">No matching patients.</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <FieldError id={id('patient-error')} message={errors.patient} />
              </div>

              <div className="space-y-1.5">
                <label htmlFor={id('label')} className="text-sm font-medium">Appointment Name<Required /></label>
                <Select value={form.label} onValueChange={(v) => v && handleNameChange(v)} disabled={nameDisabled}>
                  <SelectTrigger id={id('label')} className={`w-full ${FIELD}`} {...invalid('label')}>
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {nameOptions.map((name) => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {nameDisabled ? <p className="text-xs text-muted-foreground">Choose a patient first.</p> : <FieldError id={id('label-error')} message={errors.label} />}
              </div>

              <div className="space-y-1.5">
                <label htmlFor={id('type')} className="text-sm font-medium">Specialty<Required /></label>
                <Select value={form.type} onValueChange={(v) => v && handleTypeChange(v)} disabled={typeDisabled}>
                  <SelectTrigger id={id('type')} className={`w-full ${FIELD}`} {...invalid('type')}>
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTypes.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {typeDisabled ? (
                  <p className="text-xs text-muted-foreground">{!nameChosen ? 'Choose the appointment name first.' : 'Choose a patient first.'}</p>
                ) : (
                  <FieldError id={id('type-error')} message={errors.type} />
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor={id('doctor')} className="text-sm font-medium">Doctor<Required /></label>
                <Select value={form.doctorId} onValueChange={(v) => v && handleDoctorChange(v)} disabled={doctorDisabled}>
                  <SelectTrigger id={id('doctor')} className={`w-full ${FIELD}`} {...invalid('doctor')}>
                    <SelectValue placeholder="Select…">{doctor ? `${doctor.name} — ${doctor.specialty}` : undefined}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {availableDoctors.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">No doctors with this specialty yet.</div>
                    ) : (
                      availableDoctors.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name} — {d.specialty}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {doctorDisabled ? <p className="text-xs text-muted-foreground">Complete the fields above first.</p> : <FieldError id={id('doctor-error')} message={errors.doctor} />}
              </div>

              {request && request.options.length > 0 && (
                <div className="space-y-1 rounded-2xl border border-dashed p-3">
                  <p className="text-xs font-medium text-muted-foreground">Patient&apos;s preferred times</p>
                  <ul className="space-y-0.5 text-sm">
                    {request.options.map((o) => (
                      <li key={`${o.date}-${o.from}`}>{formatRequestOption(o)}</li>
                    ))}
                  </ul>
                  {request.notes && <p className="pt-1 text-xs text-muted-foreground">Patient&apos;s notes: {request.notes}</p>}
                </div>
              )}
            </div>

            {/* Right: when, where */}
            <div className="min-w-0 space-y-4">
              <div className="space-y-1.5">
                <label htmlFor={id('date')} className="text-sm font-medium">Date<Required /></label>
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger
                    disabled={!doctorPicked}
                    render={
                      <Button
                        id={id('date')}
                        type="button"
                        variant="outline"
                        className={`w-full justify-start font-normal ${FIELD}`}
                        {...invalid('date')}
                      />
                    }
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                    {form.date
                      ? dateKeyToDate(form.date).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })
                      : 'Choose a date'}
                  </PopoverTrigger>
                  <PopoverContent className="w-auto max-w-[calc(100vw-2rem)] rounded-2xl p-0 shadow-card" align="start">
                    <Calendar
                      mode="single"
                      selected={form.date ? dateKeyToDate(form.date) : undefined}
                      defaultMonth={form.date ? dateKeyToDate(form.date) : undefined}
                      onSelect={handleDateChange}
                      disabled={dateDisabled}
                      className="[--cell-size:--spacing(10)] md:[--cell-size:--spacing(8)]"
                      autoFocus
                    />
                  </PopoverContent>
                </Popover>
                {!doctorPicked ? (
                  <p className="text-xs text-muted-foreground">Choose a doctor first. Past dates and the doctor&apos;s days off can&apos;t be picked.</p>
                ) : (
                  <FieldError id={id('date-error')} message={errors.date} />
                )}
              </div>

              <fieldset className="space-y-1.5">
                <legend className="text-sm font-medium">Time<Required /></legend>
                <div aria-live="polite">
                  {!doctorPicked || !form.date ? (
                    <p className="text-xs text-muted-foreground">Free times appear once a doctor and date are chosen.</p>
                  ) : slots.kind === 'loading' || slots.kind === 'idle' ? (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Checking the doctor&apos;s schedule…
                    </p>
                  ) : slots.kind === 'error' ? (
                    <p className="text-sm text-red-700 dark:text-red-300">
                      Couldn&apos;t load free times.{' '}
                      <button type="button" className="underline" onClick={() => { setSlots({ kind: 'loading' }); setReloadKey((k) => k + 1); }}>
                        Try again
                      </button>
                    </p>
                  ) : shownSlots.length === 0 ? (
                    <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                      {slots.reason ? REASON_TEXT[slots.reason] : 'No free time on that day.'}
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" role="group" aria-describedby={errors.time ? id('time-error') : undefined}>
                      {shownSlots.map((s) => (
                        <button
                          key={s}
                          type="button"
                          aria-pressed={form.time === s}
                          onClick={() => setForm((f) => ({ ...f, time: s }))}
                          className={`min-h-11 rounded-xl border px-2 text-xs font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-[var(--action-ring)] md:min-h-9 ${
                            form.time === s
                              ? 'border-[var(--action)] bg-[var(--action)] text-[var(--action-foreground)] shadow-soft'
                              : 'border-input hover:bg-muted'
                          }`}
                        >
                          {hhmmTo12h(s)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <FieldError id={id('time-error')} message={errors.time} />
              </fieldset>

              <div className="space-y-1.5">
                <label htmlFor={id('location')} className="text-sm font-medium">Location</label>
                <Input
                  id={id('location')}
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  placeholder="e.g. MomCare Clinic, Room 3"
                  className={FIELD}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor={id('notes')} className="text-sm font-medium">Notes</label>
                <Textarea
                  id={id('notes')}
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
            </div>
          </fieldset>

          <div aria-live="polite">
            {error && (
              <p role="alert" className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
                {error}
              </p>
            )}
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="min-h-11 rounded-full md:min-h-9" disabled={isSaving} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" className="min-h-11 rounded-full sm:min-w-48 md:min-h-9" disabled={isSaving} aria-busy={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Saving…
                </>
              ) : editing ? (
                'Save Changes'
              ) : (
                'Create Appointment'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
