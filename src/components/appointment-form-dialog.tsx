'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AdminUserView } from '@/lib/get-users';
import type { AdminAppointment } from '@/lib/get-appointments';

const ICON_OPTIONS = ['🩺', '🔬', '🩸', '🥗', '👩‍⚕️', '💊', '🫀', '🧬'];
const COLOR_OPTIONS = ['green', 'pink', 'purple', 'blue', 'orange'] as const;

// Kept identical to the mobile app's own dropdown options — so
// appointments created from either side use the exact same
// categories, which matters for the upcoming Appointments analytics
// chart that groups by these values.
const NAME_OPTIONS = [
  'Prenatal Checkup', 'Booking Appointment', 'Nuchal Scan', 'Anomaly Scan',
  'Glucose Tolerance Test', 'Group B Strep Test', 'Ultrasound', 'Blood Test',
  'Postpartum Checkup', 'Other',
];
const TYPE_OPTIONS = [
  'Obstetrics', 'Radiology', 'Laboratory', 'Dietitian',
  'OB-GYN', 'Cardiology', 'Pediatrics', 'Other',
];

// Matches the exact conversion the mobile app already uses, so
// appointments created here render identically to ones the app
// previously created itself.
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
  editing,
  trigger,
}: {
  users: AdminUserView[];
  editing?: AdminAppointment;
  trigger: React.ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(BLANK);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
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
      } else {
        setForm(BLANK);
      }
      setError('');
    }
  }, [open, editing]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.patientUid || !form.label || !form.doctor || !form.date || !form.time) {
      setError('Please fill in all required fields.');
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Appointment' : 'New Appointment'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Patient</label>
            <Select
              value={form.patientUid}
              onValueChange={(value) => setForm({ ...form, patientUid: value })}
              disabled={!!editing}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a patient" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.uid} value={u.uid}>
                    {u.fullName} ({u.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

                    <div className="space-y-1">
            <label className="text-sm font-medium">Appointment Name</label>
            <Select value={form.label} onValueChange={(value) => setForm({ ...form, label: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {NAME_OPTIONS.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Type</label>
              <Select value={form.type} onValueChange={(value) => setForm({ ...form, type: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-1">
              <label className="text-sm font-medium">Doctor</label>
              <Input
                value={form.doctor}
                onChange={(e) => setForm({ ...form, doctor: e.target.value })}
                placeholder="e.g. Dr. Santos"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Date</label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Time</label>
              <Input
                type="time"
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Location</label>
            <Input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="e.g. MomsCare Clinic, Room 3"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Notes</label>
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Icon</label>
              <Select value={form.icon} onValueChange={(value) => setForm({ ...form, icon: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ICON_OPTIONS.map((icon) => (
                    <SelectItem key={icon} value={icon}>
                      {icon}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Color</label>
              <Select
                value={form.accentColor}
                onValueChange={(value) =>
                  setForm({ ...form, accentColor: value as FormState['accentColor'] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COLOR_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button type="submit" className="w-full" disabled={isSaving}>
            {isSaving ? 'Saving...' : editing ? 'Save Changes' : 'Create Appointment'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}