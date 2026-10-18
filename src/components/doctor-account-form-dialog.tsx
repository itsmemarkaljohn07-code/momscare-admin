'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Eye, EyeOff, Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { getApiErrorMessage } from '@/lib/error-messages';
import {
  BLANK_SCHEDULE,
  DoctorScheduleFields,
  effectiveSpecialty,
  FieldError,
  RequiredMark,
  validateSchedule,
  type ScheduleErrors,
  type ScheduleFields,
} from '@/components/doctor-schedule-fields';

const CHECK_DEBOUNCE_MS = 450;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Credentials {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const BLANK_CREDENTIALS: Credentials = { username: '', email: '', password: '', confirmPassword: '' };

type CredentialErrors = Partial<Record<keyof Credentials, string>>;

// Only ever holds the real, async-check-driven states. The "too short
// to check yet" case is derived at render time from input length
// instead — see usernameDisplayStatus/emailDisplayStatus below — so
// this never needs a synchronous setState-in-effect for that case.
type Availability = 'idle' | 'checking' | 'available' | 'taken' | 'unknown';

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
      <p className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
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

function validateCredentials(c: Credentials): CredentialErrors {
  const e: CredentialErrors = {};
  const username = c.username.trim();
  if (!username) e.username = 'Enter a username.';
  else if (username.length < 3) e.username = 'Use at least 3 characters.';
  else if (/\s/.test(username)) e.username = 'Usernames can’t contain spaces.';
  if (!c.email.trim()) e.email = 'Enter an email address.';
  else if (!EMAIL_PATTERN.test(c.email.trim())) e.email = 'Enter a valid email address.';
  if (!c.password) e.password = 'Enter a password.';
  else if (c.password.length < 6) e.password = 'Use at least 6 characters.';
  if (!c.confirmPassword) e.confirmPassword = 'Enter the password again.';
  else if (c.password !== c.confirmPassword) e.confirmPassword = 'Passwords don’t match.';
  return e;
}

function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  error,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  error?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        className="rounded-xl pr-11"
        {...(error ? { 'aria-invalid': true, 'aria-describedby': `${id}-error` } : {})}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? 'Hide password' : 'Show password'}
        aria-pressed={show}
        aria-controls={id}
        className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function DoctorAccountFormDialog({ trigger }: { trigger: React.ReactElement }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // Kept across a failed attempt (and a close/reopen); cleared only after
  // a successful create.
  const [schedule, setSchedule] = useState<ScheduleFields>(BLANK_SCHEDULE);
  const [creds, setCreds] = useState<Credentials>(BLANK_CREDENTIALS);
  const [submitted, setSubmitted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  // A ref, not state: a second click in the same tick still sees it.
  const inFlight = useRef(false);

  const [usernameStatus, setUsernameStatus] = useState<Availability>('idle');
  const [emailStatus, setEmailStatus] = useState<Availability>('idle');
  const usernameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emailTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced live check — fires 450ms after the person stops typing.
  useEffect(() => {
    const username = creds.username.trim();
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
  }, [creds.username]);

  useEffect(() => {
    const email = creds.email.trim();
    if (emailTimer.current) clearTimeout(emailTimer.current);
    if (!EMAIL_PATTERN.test(email)) return;

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
  }, [creds.email]);

  // Derived display status — overrides any stale 'checking'/'taken'/etc.
  // left over from a longer input the person has since shortened.
  const usernameDisplayStatus: Availability = creds.username.trim().length < 3 ? 'idle' : usernameStatus;
  const emailDisplayStatus: Availability = EMAIL_PATTERN.test(creds.email.trim()) ? emailStatus : 'idle';

  // Errors appear once the person has tried to submit, then update live.
  const scheduleErrors: ScheduleErrors = submitted ? validateSchedule(schedule) : {};
  const credErrors: CredentialErrors = submitted ? validateCredentials(creds) : {};
  if (usernameDisplayStatus === 'taken') credErrors.username = 'This username is already taken.';
  if (emailDisplayStatus === 'taken') credErrors.email = 'This email is already registered.';

  const setCred = (key: keyof Credentials) => (v: string) => setCreds((c) => ({ ...c, [key]: v }));

  function handleOpenChange(next: boolean) {
    // Never close while the account is being created.
    if (!next && inFlight.current) return;
    setOpen(next);
    if (next) setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (inFlight.current) return;
    setSubmitted(true);
    setError('');

    const sErr = validateSchedule(schedule);
    const cErr = validateCredentials(creds);
    if (Object.keys(sErr).length > 0 || Object.keys(cErr).length > 0) {
      setError('Please fix the highlighted fields.');
      return;
    }
    if (usernameDisplayStatus === 'taken' || emailDisplayStatus === 'taken') {
      setError('Choose a username and email that aren’t already in use.');
      return;
    }

    inFlight.current = true;
    setIsSaving(true);
    try {
      const res = await fetch('/api/doctors/create-with-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: schedule.name.trim(),
          specialty: effectiveSpecialty(schedule),
          workingDays: schedule.workingDays,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          slotMinutes: schedule.slotMinutes,
          username: creds.username.trim(),
          email: creds.email.trim(),
          password: creds.password,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(getApiErrorMessage(res, data, undefined, 'create doctor account').description);
        return;
      }

      toast.success('Doctor account created.');
      setSchedule(BLANK_SCHEDULE);
      setCreds(BLANK_CREDENTIALS);
      setSubmitted(false);
      setUsernameStatus('idle');
      setEmailStatus('idle');
      inFlight.current = false;
      setOpen(false);
      router.refresh();
    } catch (err: unknown) {
      setError(getApiErrorMessage(null, null, err, 'create doctor account').description);
    } finally {
      inFlight.current = false;
      setIsSaving(false);
    }
  }

  const checking = usernameDisplayStatus === 'checking' || emailDisplayStatus === 'checking';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[92vh] overflow-y-auto p-5 sm:max-w-3xl sm:p-6">
        <DialogHeader>
          <DialogTitle>Add Doctor Account</DialogTitle>
          <DialogDescription>
            Fields marked <span className="text-red-500">*</span> are required. The doctor signs in with the
            username and password.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <fieldset disabled={isSaving} className="grid gap-5 md:grid-cols-2">
            <section className="space-y-4 rounded-2xl border p-4" aria-labelledby="add-doctor-details">
              <h3 id="add-doctor-details" className="text-sm font-semibold">Doctor Details</h3>
              <DoctorScheduleFields
                idPrefix="add-doctor"
                value={schedule}
                onChange={setSchedule}
                errors={scheduleErrors}
              />
            </section>

            <section className="space-y-4 rounded-2xl border p-4" aria-labelledby="add-doctor-login">
              <h3 id="add-doctor-login" className="text-sm font-semibold">Login Credentials</h3>

              <div className="space-y-1.5">
                <label htmlFor="add-doctor-username" className="text-sm font-medium">
                  Username
                  <RequiredMark />
                </label>
                <Input
                  id="add-doctor-username"
                  value={creds.username}
                  onChange={(e) => setCred('username')(e.target.value)}
                  placeholder="e.g. drmaria"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  className="rounded-xl"
                  {...(credErrors.username ? { 'aria-invalid': true, 'aria-describedby': 'add-doctor-username-error' } : {})}
                />
                {credErrors.username ? (
                  <FieldError id="add-doctor-username-error" message={credErrors.username} />
                ) : usernameDisplayStatus === 'idle' ? (
                  <p className="text-xs text-muted-foreground">What the doctor types to sign in. At least 3 characters, unique.</p>
                ) : (
                  <AvailabilityHint status={usernameDisplayStatus} takenMessage="This username is already taken." />
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="add-doctor-email" className="text-sm font-medium">
                  Email
                  <RequiredMark />
                </label>
                <Input
                  id="add-doctor-email"
                  type="email"
                  value={creds.email}
                  onChange={(e) => setCred('email')(e.target.value)}
                  placeholder="doctor@example.com"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  className="rounded-xl"
                  {...(credErrors.email ? { 'aria-invalid': true, 'aria-describedby': 'add-doctor-email-error' } : {})}
                />
                {credErrors.email ? (
                  <FieldError id="add-doctor-email-error" message={credErrors.email} />
                ) : emailDisplayStatus === 'idle' ? (
                  <p className="text-xs text-muted-foreground">The account&apos;s login email, also used for recovery.</p>
                ) : (
                  <AvailabilityHint status={emailDisplayStatus} takenMessage="This email is already registered." />
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="add-doctor-password" className="text-sm font-medium">
                  Password
                  <RequiredMark />
                </label>
                <PasswordInput
                  id="add-doctor-password"
                  value={creds.password}
                  onChange={setCred('password')}
                  autoComplete="new-password"
                  error={credErrors.password}
                />
                {credErrors.password ? (
                  <FieldError id="add-doctor-password-error" message={credErrors.password} />
                ) : (
                  <p className="text-xs text-muted-foreground">At least 6 characters. Share it with the doctor securely.</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="add-doctor-confirm" className="text-sm font-medium">
                  Confirm Password
                  <RequiredMark />
                </label>
                <PasswordInput
                  id="add-doctor-confirm"
                  value={creds.confirmPassword}
                  onChange={setCred('confirmPassword')}
                  autoComplete="new-password"
                  error={credErrors.confirmPassword}
                />
                <FieldError id="add-doctor-confirm-error" message={credErrors.confirmPassword} />
              </div>
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
            <Button type="submit" className="h-10 rounded-full sm:min-w-52" disabled={isSaving || checking} aria-busy={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Creating account…
                </>
              ) : (
                'Create Doctor Account'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
