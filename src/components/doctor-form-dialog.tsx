'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { DoctorRecord } from '@/lib/get-doctors';

const TYPE_OPTIONS = [
  'Obstetrics', 'OB-GYN', 'Radiology', 'Laboratory',
  'Dietitian', 'Cardiology', 'Pediatrics', 'General Physician', 'Other',
];

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface FormState {
  name: string;
  specialty: string;
  workingDays: number[];
  startTime: string;
  endTime: string;
  slotMinutes: number;
}

const BLANK: FormState = {
  name: '', specialty: '', workingDays: [], startTime: '09:00', endTime: '17:00', slotMinutes: 30,
};

export function DoctorFormDialog({
  editing,
  trigger,
}: {
  editing?: DoctorRecord;
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
          name: editing.name,
          specialty: editing.specialty,
          workingDays: editing.workingDays,
          startTime: editing.startTime,
          endTime: editing.endTime,
          slotMinutes: editing.slotMinutes,
        });
      } else {
        setForm(BLANK);
      }
      setError('');
    }
  }, [open, editing]);

  function toggleDay(day: number, checked: boolean) {
    setForm((f) => ({
      ...f,
      workingDays: checked
        ? [...f.workingDays, day].sort((a, b) => a - b)
        : f.workingDays.filter((d) => d !== day),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.specialty || form.workingDays.length === 0 || !form.startTime || !form.endTime) {
      setError('Please complete all required fields.');
      return;
    }
    if (form.startTime >= form.endTime) {
      setError('End time must be after start time.');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const res = editing
        ? await fetch(`/api/doctors/${editing.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
          })
        : await fetch('/api/doctors', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
          });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to save doctor.');
        setIsSaving(false);
        return;
      }

      toast.success(editing ? 'Doctor updated.' : 'Doctor added.');
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Doctor' : 'Add New Doctor'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Full Name</label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Dr. Maria Santos"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Specialty</label>
            <Select value={form.specialty} onValueChange={(value) => setForm((f) => ({ ...f, specialty: value }))}>
              <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Working Days</label>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
              {DAY_LABELS.map((label, i) => (
                <label key={i} className="flex items-center gap-1.5 text-sm">
                  <Checkbox
                    checked={form.workingDays.includes(i)}
                    onCheckedChange={(checked) => toggleDay(i, checked === true)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Start Time</label>
              <Input
                type="time"
                value={form.startTime}
                onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">End Time</label>
              <Input
                type="time"
                value={form.endTime}
                onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Slot Length (minutes)</label>
            <Input
              type="number"
              min={5}
              step={5}
              value={form.slotMinutes}
              onChange={(e) => setForm((f) => ({ ...f, slotMinutes: Number(e.target.value) }))}
              required
            />
            <p className="text-xs text-muted-foreground">How long each appointment slot is.</p>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button type="submit" className="w-full" disabled={isSaving}>
            {isSaving ? 'Saving...' : editing ? 'Save Changes' : 'Add Doctor'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}