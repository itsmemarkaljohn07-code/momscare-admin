'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Eye, EyeOff, Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const TYPE_OPTIONS = [
  'Obstetrics', 'OB-GYN', 'Radiology', 'Laboratory',
  'Dietitian', 'Cardiology', 'Pediatrics', 'General Physician', 'Other',
];

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const CHECK_DEBOUNCE_MS = 450;

interface FormState {
  name: string;
  specialty: string;
  workingDays: number[];
  startTime: string;
  endTime: string;
  slotMinutes: number;
  email: string;
  password: string;
  username: string;
}

const BLANK: FormState = {
  name: '', specialty: '', workingDays: [], startTime: '09:00', endTime: '17:00',
  slotMinutes: 30, email: '', password: '', username: '',
};

// Only ever holds the real, async-check-driven states. The "too short
// to check yet" case is derived at render time from input length
// instead — see usernameDisplayStatus/emailDisplayStatus below — so
// this never needs a synchronous setState-in-effect for that case.
type Availability = 'idle' | 'checking' | 'available' | 'taken' | 'unknown';

// Hoisted to module scope — a component defined inside another
// component's body gets recreated on every render, which resets its
// identity and defeats React's reconciliation. This has no state of
// its own, so it's a plain, stable function component.
function AvailabilityHint({ status, takenMessage }: { status: Availability; takenMessage: string }) {
  if (status === 'checking') {
    return (
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Checking availability…
      </p>
    );
  }
  if (status === 'taken') {
    return (
      <p className="flex items-center gap-1 text-xs text-red-500">
        <X className="h-3 w-3" /> {takenMessage}
      </p>
    );
  }
  if (status === 'available') {
    return (
      <p className="flex items-center gap-1 text-xs" style={{ color: 'var(--status-approved)' }}>
        <Check className="h-3 w-3" /> Available
      </p>
    );
  }
  return null;
}

export function DoctorAccountFormDialog({ trigger }: { trigger: React.ReactElement }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(BLANK);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const [usernameStatus, setUsernameStatus] = useState<Availability>('idle');
  const [emailStatus, setEmailStatus] = useState<Availability>('idle');
  const usernameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emailTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset all form state exactly once per open transition — computed
  // during render (React's documented alternative to an effect for
  // this exact "reset on prop/flag change" case) rather than via
  // setState inside a useEffect.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setForm(BLANK);
      setConfirmPassword('');
      setError('');
      setUsernameStatus('idle');
      setEmailStatus('idle');
    }
  }

  // Debounced live check — fires 450ms after the person stops typing.
  // For a too-short username, this simply skips checking (and clears
  // any pending timer) rather than setState-ing an 'idle' status —
  // "too short" is derived below from form.username's length instead.
  useEffect(() => {
    const username = form.username.trim();
    if (usernameTimer.current) clearTimeout(usernameTimer.current);
    if (username.length < 3) return;

    usernameTimer.current = setTimeout(async () => {
      setUsernameStatus('checking');
      try {
        const res = await fetch(`/api/doctors/check-availability?username=${encodeURIComponent(username)}`);
        const data = await res.json().catch(() => ({}));
        if (data.usernameTaken === true) setUsernameStatus('taken');
        else if (data.usernameTaken === false) setUsernameStatus('available');
        else setUsernameStatus('unknown');
      } catch {
        setUsernameStatus('unknown');
      }
    }, CHECK_DEBOUNCE_MS);

    return () => {
      if (usernameTimer.current) clearTimeout(usernameTimer.current);
    };
  }, [form.username]);

  useEffect(() => {
    const email = form.email.trim();
    if (emailTimer.current) clearTimeout(emailTimer.current);
    if (!email.includes('@') || !email.includes('.')) return;

    emailTimer.current = setTimeout(async () => {
      setEmailStatus('checking');
      try {
        const res = await fetch(`/api/doctors/check-availability?email=${encodeURIComponent(email)}`);
        const data = await res.json().catch(() => ({}));
        if (data.emailTaken === true) setEmailStatus('taken');
        else if (data.emailTaken === false) setEmailStatus('available');
        else setEmailStatus('unknown');
      } catch {
        setEmailStatus('unknown');
      }
    }, CHECK_DEBOUNCE_MS);

    return () => {
      if (emailTimer.current) clearTimeout(emailTimer.current);
    };
  }, [form.email]);

  // Derived display status — overrides any stale 'checking'/'taken'/etc.
  // left over from a longer input the person has since shortened.
  const usernameDisplayStatus: Availability =
    form.username.trim().length < 3 ? 'idle' : usernameStatus;
  const emailDisplayStatus: Availability =
    form.email.trim().includes('@') && form.email.trim().includes('.') ? emailStatus : 'idle';

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
    setError('');

    if (
      !form.name || !form.specialty || form.workingDays.length === 0 ||
      !form.startTime || !form.endTime || !form.email || !form.password || !form.username
    ) {
      setError('Please complete all required fields.');
      return;
    }
    if (form.startTime >= form.endTime) {
      setError('End time must be after start time.');
      return;
    }
    if (usernameDisplayStatus === 'taken') {
      setError('Username is already taken.');
      return;
    }
    if (emailDisplayStatus === 'taken') {
      setError('Email is already registered.');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (form.password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSaving(true);

    try {
      const res = await fetch('/api/doctors/create-with-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to create doctor account.');
        setIsSaving(false);
        return;
      }

      toast.success('Doctor account created.');
      setOpen(false);
      setForm(BLANK);
      setConfirmPassword('');
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setIsSaving(false);
    }
  }

  const canSubmit =
    !isSaving && usernameDisplayStatus !== 'taken' && usernameDisplayStatus !== 'checking' &&
    emailDisplayStatus !== 'taken' && emailDisplayStatus !== 'checking';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Doctor Account</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3 rounded-md border p-3">
            <p className="text-sm font-medium">Doctor Details</p>

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
              <Select value={form.specialty} onValueChange={(value) => value && setForm((f) => ({ ...f, specialty: value }))}>
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
            </div>
          </div>

          <div className="space-y-3 rounded-md border p-3">
            <p className="text-sm font-medium">Login Credentials</p>

            <div className="space-y-1">
              <label className="text-sm font-medium">Username</label>
              <Input
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                placeholder="e.g. drmaria"
                required
              />
              <AvailabilityHint status={usernameDisplayStatus} takenMessage="Username is already taken." />
              {usernameDisplayStatus === 'idle' && (
                <p className="text-xs text-muted-foreground">
                  What the doctor will type to log in — at least 3 characters, must be unique.
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
              <AvailabilityHint status={emailDisplayStatus} takenMessage="Email is already registered." />
              {emailDisplayStatus === 'idle' && (
                <p className="text-xs text-muted-foreground">
                  Used for account recovery and communication — not for logging in.
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Password</label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="pr-10"
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-0 top-0 flex h-full w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                At least 6 characters. Share this with the doctor securely.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Confirm Password</label>
              <div className="relative">
                <Input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pr-10"
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-0 top-0 flex h-full w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button type="submit" className="w-full" disabled={!canSubmit}>
            {isSaving ? 'Creating...' : 'Create Doctor Account'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}