'use client';

import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

export const SPECIALTY_OPTIONS = [
  'Obstetrics', 'OB-GYN', 'Radiology', 'Laboratory',
  'Dietitian', 'Cardiology', 'Pediatrics', 'General Physician', 'Other',
];

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** The doctor fields that exist today (doctors/{id}). */
export interface ScheduleFields {
  name: string;
  specialty: string;
  workingDays: number[];
  startTime: string;
  endTime: string;
  slotMinutes: number;
}

export type ScheduleErrors = Partial<Record<keyof ScheduleFields, string>>;

export const BLANK_SCHEDULE: ScheduleFields = {
  name: '', specialty: '', workingDays: [], startTime: '09:00', endTime: '17:00', slotMinutes: 30,
};

/** Inline validation for the schedule half of the form. */
export function validateSchedule(f: ScheduleFields): ScheduleErrors {
  const e: ScheduleErrors = {};
  if (!f.name.trim()) e.name = 'Enter the doctor’s full name.';
  if (!f.specialty) e.specialty = 'Choose a specialty.';
  if (f.workingDays.length === 0) e.workingDays = 'Choose at least one working day.';
  if (!f.startTime) e.startTime = 'Enter a start time.';
  if (!f.endTime) e.endTime = 'Enter an end time.';
  else if (f.startTime && f.startTime >= f.endTime) e.endTime = 'End time must be after the start time.';
  if (!Number.isFinite(f.slotMinutes) || f.slotMinutes < 5) e.slotMinutes = 'Slot length must be at least 5 minutes.';
  return e;
}

export function RequiredMark() {
  return (
    <span className="text-red-500" aria-hidden="true">
      {' '}*
    </span>
  );
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-xs text-red-600 dark:text-red-400">
      {message}
    </p>
  );
}

/** Name, specialty, working days, hours and slot length — the same
 *  controls in Add Doctor Account and Edit Doctor. */
export function DoctorScheduleFields({
  value,
  onChange,
  errors,
  nameLocked = false,
  idPrefix,
}: {
  value: ScheduleFields;
  onChange: (next: ScheduleFields) => void;
  errors: ScheduleErrors;
  /** Edit: a doctor's name can't change (the server refuses it too). */
  nameLocked?: boolean;
  idPrefix: string;
}) {
  const set = <K extends keyof ScheduleFields>(key: K, v: ScheduleFields[K]) => onChange({ ...value, [key]: v });
  const id = (k: string) => `${idPrefix}-${k}`;
  const invalid = (k: keyof ScheduleFields) =>
    errors[k] ? { 'aria-invalid': true as const, 'aria-describedby': id(`${k}-error`) } : {};

  function toggleDay(day: number) {
    const has = value.workingDays.includes(day);
    set('workingDays', has ? value.workingDays.filter((d) => d !== day) : [...value.workingDays, day].sort((a, b) => a - b));
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor={id('name')} className="text-sm font-medium">
          Full Name
          {!nameLocked && <RequiredMark />}
        </label>
        <Input
          id={id('name')}
          value={value.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="e.g. Dr. Maria Santos"
          className="rounded-xl"
          disabled={nameLocked}
          autoComplete="off"
          {...invalid('name')}
        />
        <FieldError id={id('name-error')} message={errors.name} />
        {nameLocked && (
          <p className="text-xs text-muted-foreground">
            A doctor&apos;s name can&apos;t be changed: their appointments, patients and login are linked to it.
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor={id('specialty')} className="text-sm font-medium">
          Specialty
          <RequiredMark />
        </label>
        <Select value={value.specialty} onValueChange={(v) => v && set('specialty', v)}>
          <SelectTrigger id={id('specialty')} className="w-full rounded-xl" {...invalid('specialty')}>
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {SPECIALTY_OPTIONS.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError id={id('specialty-error')} message={errors.specialty} />
      </div>

      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">
          Working Days
          <RequiredMark />
        </legend>
        <div className="flex flex-wrap gap-2" {...(errors.workingDays ? { 'aria-describedby': id('workingDays-error') } : {})}>
          {DAY_LABELS.map((label, i) => {
            const on = value.workingDays.includes(i);
            return (
              <button
                key={label}
                type="button"
                onClick={() => toggleDay(i)}
                aria-pressed={on}
                aria-label={DAY_NAMES[i]}
                className={`h-9 min-w-12 rounded-full border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                  on
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <FieldError id={id('workingDays-error')} message={errors.workingDays} />
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor={id('start')} className="text-sm font-medium">
            Start Time
            <RequiredMark />
          </label>
          <Input
            id={id('start')}
            type="time"
            value={value.startTime}
            onChange={(e) => set('startTime', e.target.value)}
            className="rounded-xl"
            {...invalid('startTime')}
          />
          <FieldError id={id('startTime-error')} message={errors.startTime} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={id('end')} className="text-sm font-medium">
            End Time
            <RequiredMark />
          </label>
          <Input
            id={id('end')}
            type="time"
            value={value.endTime}
            onChange={(e) => set('endTime', e.target.value)}
            className="rounded-xl"
            {...invalid('endTime')}
          />
          <FieldError id={id('endTime-error')} message={errors.endTime} />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor={id('slot')} className="text-sm font-medium">
          Slot Length (minutes)
          <RequiredMark />
        </label>
        <Input
          id={id('slot')}
          type="number"
          inputMode="numeric"
          min={5}
          step={5}
          value={Number.isFinite(value.slotMinutes) ? value.slotMinutes : ''}
          onChange={(e) => set('slotMinutes', e.target.value === '' ? NaN : Number(e.target.value))}
          className="rounded-xl"
          {...invalid('slotMinutes')}
        />
        <FieldError id={id('slotMinutes-error')} message={errors.slotMinutes} />
        {!errors.slotMinutes && <p className="text-xs text-muted-foreground">How long each appointment slot is.</p>}
      </div>
    </div>
  );
}
