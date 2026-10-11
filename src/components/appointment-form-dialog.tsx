'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import type { AdminUserView } from '@/lib/get-users';
import type { AdminAppointment } from '@/lib/get-appointments';
import type { DoctorRecord } from '@/lib/get-doctors';

const ICON_OPTIONS = ['🩺', '🔬', '🩸', '🥗', '👩‍⚕️', '💊', '🫀', '🧬'];
const ICON_NAMES: Record<string, string> = {
  '🩺': 'Stethoscope', '🔬': 'Microscope', '🩸': 'Blood Test', '🥗': 'Nutrition',
  '👩‍⚕️': 'Provider', '💊': 'Medication', '🫀': 'Cardiology', '🧬': 'Genetics',
};
const COLOR_OPTIONS = ['green', 'pink', 'purple', 'blue', 'orange'] as const;

const NAME_OPTIONS = [
  'Prenatal Checkup', 'Booking Appointment', 'Nuchal Scan', 'Anomaly Scan',
  'Glucose Tolerance Test', 'Group B Strep Test', 'Ultrasound', 'Blood Test',
  'Postpartum Checkup', 'Other',
];
const TYPE_OPTIONS = [
  'Obstetrics', 'OB-GYN', 'Radiology', 'Laboratory',
  'Dietitian', 'Cardiology', 'Pediatrics', 'General Physician', 'Other',
];

const NAME_TO_TYPES: Record<string, string[]> = {
  'Prenatal Checkup': ['Obstetrics', 'OB-GYN', 'General Physician'],
  'Booking Appointment': ['Obstetrics', 'OB-GYN'],
  'Nuchal Scan': ['Radiology', 'OB-GYN'],
  'Anomaly Scan': ['Radiology', 'OB-GYN'],
  'Glucose Tolerance Test': ['Laboratory', 'Dietitian'],
  'Group B Strep Test': ['Laboratory'],
  'Ultrasound': ['Radiology', 'OB-GYN'],
  'Blood Test': ['Laboratory'],
  'Postpartum Checkup': ['Obstetrics', 'OB-GYN', 'General Physician'],
  'Other': TYPE_OPTIONS,
};

const DAYS_AHEAD = 21;

function to12Hour(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${suffix}`;
}

function to24Hour(time12: string): string {
  const match = time12.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return '';
  const [, hStr, m, suffix] = match;
  let hour = parseInt(hStr, 10);
  if (suffix.toUpperCase() === 'PM' && hour !== 12) hour += 12;
  if (suffix.toUpperCase() === 'AM' && hour === 12) hour = 0;
  return `${hour.toString().padStart(2, '0')}:${m}`;
}

function dateKeyToDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function generateTimeSlots(start: string, end: string, stepMinutes: number): string[] {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const slots: string[] = [];
  let cursor = sh * 60 + sm;
  const endMinutes = eh * 60 + em;
  while (cursor < endMinutes) {
    const h = Math.floor(cursor / 60);
    const m = cursor % 60;
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    cursor += stepMinutes;
  }
  return slots;
}

interface FormState {
  patientUid: string;
  label: string;
  type: string;
  doctor: string;
  date: string;
  time: string;
  location: string;
  notes: string;
  icon: string;
  accentColor: (typeof COLOR_OPTIONS)[number];
}

const BLANK: FormState = {
  patientUid: '', label: '', type: '', doctor: '',
  date: '', time: '', location: '', notes: '',
  icon: '🩺', accentColor: 'green',
};

export function AppointmentFormDialog({
  users,
  appointments,
  doctors,
  editing,
  trigger,
}: {
  users: AdminUserView[];
  appointments: AdminAppointment[];
  doctors: DoctorRecord[];
  editing?: AdminAppointment;
  trigger: React.ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(BLANK);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const [patientQuery, setPatientQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const [pickerDate, setPickerDate] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const isSequential = !editing;
  const patientChosen = !!form.patientUid;
  const nameChosen = !!form.label;
  const typeChosen = !!form.type;
  const doctorPicked = !!form.doctor;
  const dateTimeChosen = !!form.date && !!form.time;

  const nameDisabled = isSequential && !patientChosen;
  const typeDisabled = isSequential ? !patientChosen || !nameChosen : !nameChosen;
  const doctorDisabled = isSequential
    ? !patientChosen || !nameChosen || !typeChosen
    : !typeChosen;
  const detailsDisabled = isSequential && !dateTimeChosen;

  const availableTypes = nameChosen ? (NAME_TO_TYPES[form.label] ?? []) : [];
  const availableDoctors = typeChosen ? doctors.filter((d) => d.specialty === form.type) : [];

  const selectedDoctor = doctors.find((d) => d.name === form.doctor) ?? null;

  const bookedSet = useMemo(() => {
    const set = new Set<string>();
    for (const a of appointments) {
      if (a.status !== 'upcoming') continue;
      if (a.doctor !== form.doctor) continue;
      if (editing && a.id === editing.id) continue;
      set.add(`${a.date}|${to24Hour(a.time)}`);
    }
    return set;
  }, [appointments, form.doctor, editing]);

  const scheduleDays = useMemo(() => {
    if (!selectedDoctor) return [];
    const today = new Date();
    const days: { dateKey: string; label: string; slots: { time: string; booked: boolean }[] }[] = [];

    for (let i = 0; i < DAYS_AHEAD; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      if (!selectedDoctor.workingDays.includes(d.getDay())) continue;

      const dateKey = toLocalDateKey(d);
      const times = generateTimeSlots(selectedDoctor.startTime, selectedDoctor.endTime, selectedDoctor.slotMinutes);
      const slots = times.map((time) => ({ time, booked: bookedSet.has(`${dateKey}|${time}`) }));

      days.push({
        dateKey,
        label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        slots,
      });
    }
    return days;
  }, [selectedDoctor, bookedSet]);

  const scheduleByDate = useMemo(() => {
    const map = new Map<string, { time: string; booked: boolean }[]>();
    for (const day of scheduleDays) map.set(day.dateKey, day.slots);
    return map;
  }, [scheduleDays]);

  const activeDaySlots = pickerDate ? (scheduleByDate.get(pickerDate) ?? []) : [];

  function isDateUnavailable(date: Date): boolean {
    const key = toLocalDateKey(date);
    const slots = scheduleByDate.get(key);
    if (!slots) return true;
    return slots.every((s) => s.booked);
  }

  function selectSlot(dateKey: string, time24: string) {
    setForm((f) => ({ ...f, date: dateKey, time: time24 }));
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset the form exactly once per open/editing transition — computed
  // during render (the same pattern already used in
  // doctor-account-form-dialog.tsx) rather than via setState inside a
  // useEffect.
  const [wasOpen, setWasOpen] = useState(open);
  const [prevEditingId, setPrevEditingId] = useState(editing?.id);
  if (open !== wasOpen || editing?.id !== prevEditingId) {
    setWasOpen(open);
    setPrevEditingId(editing?.id);
    if (open) {
      if (editing) {
        setForm({
          patientUid: editing.patientUid,
          label: editing.label,
          type: editing.type,
          doctor: editing.doctor,
          date: editing.date,
          time: to24Hour(editing.time),
          location: editing.location ?? '',
          notes: editing.notes ?? '',
          icon: editing.icon,
          accentColor: editing.accentColor,
        });
        setPatientQuery(editing.patientName);
      } else {
        setForm(BLANK);
        setPatientQuery('');
      }
      setError('');
      setShowSuggestions(false);
      setPickerDate(null);
    }
  }

  const filteredPatients = patientQuery.trim()
    ? users.filter((u) => u.fullName.toLowerCase().includes(patientQuery.trim().toLowerCase())).slice(0, 8)
    : [];

  function handlePatientInputChange(value: string) {
    setPatientQuery(value);
    setForm((f) => ({ ...f, patientUid: '' }));
    setShowSuggestions(true);
  }

  function selectPatient(u: AdminUserView) {
    setForm((f) => ({ ...f, patientUid: u.uid }));
    setPatientQuery(u.fullName);
    setShowSuggestions(false);
  }

  function handleNameChange(value: string) {
    const allowedTypes = NAME_TO_TYPES[value] ?? [];
    const keepType = allowedTypes.includes(form.type);
    setForm((f) => ({
      ...f,
      label: value,
      type: keepType ? f.type : '',
      doctor: keepType ? f.doctor : '',
    }));
  }

  function handleTypeChange(value: string) {
    const doctorStillValid = doctors.some((d) => d.name === form.doctor && d.specialty === value);
    setForm((f) => ({
      ...f,
      type: value,
      doctor: doctorStillValid ? f.doctor : '',
      date: doctorStillValid ? f.date : '',
      time: doctorStillValid ? f.time : '',
    }));
    setPickerDate(null);
  }

  function handleDoctorChange(value: string) {
    setForm((f) => ({ ...f, doctor: value, date: '', time: '' }));
    setPickerDate(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.patientUid || !form.label || !form.type || !form.doctor || !form.date || !form.time) {
      setError('Please complete all required fields.');
      return;
    }

    setIsSaving(true);
    setError('');

    const payload = {
      label: form.label,
      type: form.type,
      doctor: form.doctor,
      date: form.date,
      time: to12Hour(form.time),
      location: form.location || undefined,
      notes: form.notes || undefined,
      icon: form.icon,
      accentColor: form.accentColor,
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
            body: JSON.stringify({ patientUid: form.patientUid, ...payload }),
          });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to save appointment.');
        setIsSaving(false);
        return;
      }

      setOpen(false);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Appointment' : 'New Appointment'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1" ref={searchRef}>
            <label className="text-sm font-medium">Patient</label>
            {editing ? (
              <Input value={patientQuery} disabled className="rounded-xl" />
            ) : (
              <div className="relative">
                <Input
                  value={patientQuery}
                  onChange={(e) => handlePatientInputChange(e.target.value)}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder="Search by patient name..."
                  autoComplete="off"
                  className="rounded-xl"
                />
                {showSuggestions && patientQuery.trim() && (
                  <div className="absolute z-50 mt-1 w-full rounded-xl border bg-popover shadow-card">
                    {filteredPatients.length > 0 ? (
                      <ul className="max-h-56 overflow-y-auto py-1">
                        {filteredPatients.map((u) => (
                          <li key={u.uid}>
                            <button
                              type="button"
                              className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                              onClick={() => selectPatient(u)}
                            >
                              {u.fullName}
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
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Appointment Name</label>
            <Select value={form.label} onValueChange={(v) => v && handleNameChange(v)} disabled={nameDisabled}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                {NAME_OPTIONS.map((name) => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {nameDisabled && <p className="text-xs text-muted-foreground">Select a patient first.</p>}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Appointment Type</label>
            <Select value={form.type} onValueChange={(v) => v && handleTypeChange(v)} disabled={typeDisabled}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                {availableTypes.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {typeDisabled && (
              <p className="text-xs text-muted-foreground">
                {!nameChosen ? 'Select an appointment name first.' : 'Select a patient first.'}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Doctor</label>
            <Select value={form.doctor} onValueChange={(v) => v && handleDoctorChange(v)} disabled={doctorDisabled}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                {availableDoctors.length === 0 ? (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    No doctors with this specialty yet.
                  </div>
                ) : (
                  availableDoctors.map((d) => (
                    <SelectItem key={d.id} value={d.name}>{d.name} — {d.specialty}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {doctorDisabled && (
              <p className="text-xs text-muted-foreground">Complete the previous steps first.</p>
            )}
          </div>

          {isSequential && doctorPicked && (
            <div className="animate-in fade-in slide-in-from-top-1 space-y-3 rounded-2xl border p-4 shadow-soft duration-300">
              <p className="text-sm font-medium">{form.doctor}&apos;s Availability</p>

              {scheduleDays.length === 0 ? (
                <p className="text-sm text-muted-foreground">No available appointments for this doctor.</p>
              ) : (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Select Date</label>
                    <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                      <PopoverTrigger
                        render={<Button type="button" variant="outline" className="w-full justify-start rounded-xl font-normal" />}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {pickerDate
                          ? dateKeyToDate(pickerDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
                          : 'Choose a date'}
                      </PopoverTrigger>
                      <PopoverContent className="w-auto rounded-2xl p-0 shadow-card" align="start">
                        <Calendar
                          mode="single"
                          selected={pickerDate ? dateKeyToDate(pickerDate) : undefined}
                          onSelect={(date) => {
                            if (!date) return;
                            setPickerDate(toLocalDateKey(date));
                            setCalendarOpen(false);
                          }}
                          disabled={(date) => {
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            if (date < today) return true;
                            return isDateUnavailable(date);
                          }}
                          autoFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {pickerDate && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Available Time</label>
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {activeDaySlots.map((slot) => {
                          const isSelected = form.date === pickerDate && form.time === slot.time;
                          return (
                            <button
                              key={slot.time}
                              type="button"
                              disabled={slot.booked}
                              onClick={() => selectSlot(pickerDate, slot.time)}
                              className={`rounded-xl border px-2 py-2 text-xs font-medium transition-colors ${
                                slot.booked
                                  ? 'cursor-not-allowed border-muted bg-muted text-muted-foreground line-through'
                                  : isSelected
                                  ? 'border-primary bg-primary text-primary-foreground shadow-soft'
                                  : 'border-input hover:bg-muted'
                              }`}
                            >
                              {to12Hour(slot.time)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {form.date && form.time && (
                    <p className="pt-1 text-xs text-muted-foreground">
                      Selected:{' '}
                      <span className="font-medium text-foreground">
                        {new Date(form.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at {to12Hour(form.time)}
                      </span>
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {editing && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">Date</label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  className="rounded-xl"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Time</label>
                <Input
                  type="time"
                  value={form.time}
                  onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                  className="rounded-xl"
                  required
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-sm font-medium">Location</label>
            <Input
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              placeholder="e.g. MomCare Clinic, Room 3"
              disabled={detailsDisabled}
              className="rounded-xl"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Notes</label>
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              disabled={detailsDisabled}
              className="rounded-xl"
            />
            {detailsDisabled && <p className="text-xs text-muted-foreground">Select a date and time first.</p>}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Icon</label>
              <Select value={form.icon} onValueChange={(value) => value && setForm((f) => ({ ...f, icon: value }))} disabled={detailsDisabled}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ICON_OPTIONS.map((icon) => (
                    <SelectItem key={icon} value={icon}>
                      <span className="mr-1.5">{icon}</span>{ICON_NAMES[icon]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Color</label>
              <Select
                value={form.accentColor}
                onValueChange={(value) => value && setForm((f) => ({ ...f, accentColor: value as FormState['accentColor'] }))}
                disabled={detailsDisabled}
              >
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COLOR_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
              {error}
            </p>
          )}

          <Button type="submit" className="h-11 w-full rounded-full" disabled={isSaving}>
            {isSaving ? 'Saving...' : editing ? 'Save Changes' : 'Create Appointment'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}