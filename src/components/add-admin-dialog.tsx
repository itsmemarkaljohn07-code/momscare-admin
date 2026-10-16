'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, Copy, KeyRound, ShieldCheck, UserPlus, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/password-input';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { getApiErrorMessage } from '@/lib/error-messages';

const MIN_PASSWORD = 6; // what the server and Firebase require
const GENERATED_LENGTH = 14;
// No look-alike characters (0/O, 1/l/I), so it can be read out or typed.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*?';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function generatePassword(): string {
  const out: string[] = [];
  const limit = 256 - (256 % ALPHABET.length); // avoid modulo bias
  const bytes = new Uint8Array(1);
  while (out.length < GENERATED_LENGTH) {
    crypto.getRandomValues(bytes);
    if (bytes[0] < limit) out.push(ALPHABET[bytes[0] % ALPHABET.length]);
  }
  return out.join('');
}

function passwordStrength(pw: string): { label: string; level: 0 | 1 | 2 | 3 } {
  if (!pw) return { label: '', level: 0 };
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (pw.length < 8 || kinds < 2) return { label: 'Weak', level: 1 };
  if (pw.length < 12 || kinds < 3) return { label: 'Fair', level: 2 };
  return { label: 'Strong', level: 3 };
}

const STRENGTH_COLOR = ['', 'var(--status-declined)', 'var(--status-pending)', 'var(--status-approved)'];

type Errors = { email?: string; password?: string };

export function AddAdminDialog() {
  const router = useRouter();
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState<'password' | 'details' | null>(null);

  const strength = passwordStrength(password);

  function reset() {
    setEmail('');
    setPassword('');
    setErrors({});
    setServerError('');
    setCreated(null);
    setCopied(null);
  }

  function onOpenChange(next: boolean) {
    if (isSaving) return; // don't close mid-request
    setOpen(next);
    if (!next) reset();
  }

  async function copy(text: string, what: 'password' | 'details') {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied((c) => (c === what ? null : c)), 2000);
    } catch {
      toast.error('Could not copy. Select the text and copy it manually.');
    }
  }

  function validate(): Errors {
    const found: Errors = {};
    const e = email.trim();
    if (!e) found.email = 'Enter their email address.';
    else if (!EMAIL_PATTERN.test(e)) found.email = 'Enter a valid email address, e.g. name@example.com.';
    if (!password) found.password = 'Enter a temporary password, or use Generate.';
    else if (password.length < MIN_PASSWORD) found.password = `Use at least ${MIN_PASSWORD} characters.`;
    return found;
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (isSaving) return;
    setServerError('');
    const found = validate();
    setErrors(found);
    if (found.email || found.password) {
      document.getElementById(`${uid}-${found.email ? 'email' : 'password'}`)?.focus();
      return;
    }

    setIsSaving(true);
    const cleanEmail = email.trim().toLowerCase();
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg = getApiErrorMessage(res, data, undefined, 'create admin').description;
        if (res.status === 409) setErrors({ email: msg });
        else setServerError(msg);
        return;
      }
      setCreated({ email: cleanEmail, password });
      toast.success('Admin account created.');
      router.refresh();
    } catch (err: unknown) {
      setServerError(getApiErrorMessage(null, null, err, 'create admin').description);
    } finally {
      setIsSaving(false);
    }
  }

  const fid = (k: string) => `${uid}-${k}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button className="h-10 gap-1.5 px-4" />}>
        <UserPlus className="h-4 w-4" />
        Add admin
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        {created ? (
          <div className="space-y-5">
            <DialogHeader>
              <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--status-approved-bg)] text-[var(--status-approved)]">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <DialogTitle>Admin account created</DialogTitle>
              <DialogDescription>
                Share these sign-in details privately (in person or a direct message, not a group chat). This is
                the only time the password is shown.
              </DialogDescription>
            </DialogHeader>

            <dl className="space-y-3 rounded-xl border bg-muted/30 p-4 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Email</dt>
                <dd className="break-all font-medium">{created.email}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Temporary password</dt>
                <dd className="flex items-center justify-between gap-2">
                  <code className="break-all rounded bg-background px-2 py-1 font-mono text-sm">{created.password}</code>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 shrink-0 gap-1.5"
                    onClick={() => copy(created.password, 'password')}
                  >
                    {copied === 'password' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied === 'password' ? 'Copied' : 'Copy'}
                  </Button>
                </dd>
              </div>
            </dl>

            <DialogFooter className="mx-0 mb-0 rounded-none border-0 bg-transparent p-0 sm:justify-between">
              <Button
                type="button"
                variant="secondary"
                className="h-10 gap-1.5"
                onClick={() => copy(`Email: ${created.email}\nTemporary password: ${created.password}`, 'details')}
              >
                {copied === 'details' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied === 'details' ? 'Copied' : 'Copy sign-in details'}
              </Button>
              <Button type="button" className="h-10 px-6" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleCreate} noValidate className="space-y-5">
            <DialogHeader>
              <DialogTitle>Add an admin</DialogTitle>
              <DialogDescription>
                Admins have full access to the dashboard: patients, doctors, appointments, Insights and other
                admins. Only add people who need it.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-1.5">
              <label htmlFor={fid('email')} className="text-sm font-medium">
                Email address<span className="ml-0.5 text-destructive" aria-hidden>*</span>
              </label>
              <Input
                id={fid('email')}
                type="email"
                inputMode="email"
                autoComplete="off"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
                }}
                placeholder="name@example.com"
                className="h-10 rounded-xl"
                aria-invalid={!!errors.email || undefined}
                aria-describedby={errors.email ? fid('email-error') : fid('email-hint')}
                disabled={isSaving}
                autoFocus
              />
              {errors.email ? (
                <p id={fid('email-error')} role="alert" className="text-xs font-medium text-destructive">{errors.email}</p>
              ) : (
                <p id={fid('email-hint')} className="text-xs text-muted-foreground">They sign in with this email.</p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor={fid('password')} className="text-sm font-medium">
                  Temporary password<span className="ml-0.5 text-destructive" aria-hidden>*</span>
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-[var(--action)]"
                  disabled={isSaving}
                  onClick={() => {
                    setPassword(generatePassword());
                    setErrors((p) => ({ ...p, password: undefined }));
                  }}
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  Generate
                </Button>
              </div>
              <div className="flex gap-2">
                <div className="min-w-0 flex-1">
                  <PasswordInput
                    id={fid('password')}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password) setErrors((p) => ({ ...p, password: undefined }));
                    }}
                    placeholder={`At least ${MIN_PASSWORD} characters`}
                    className="h-10 rounded-xl font-mono"
                    aria-invalid={!!errors.password || undefined}
                    aria-describedby={errors.password ? fid('password-error') : fid('password-hint')}
                    disabled={isSaving}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  aria-label="Copy password"
                  title="Copy password"
                  disabled={!password || isSaving}
                  onClick={() => copy(password, 'password')}
                >
                  {copied === 'password' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>

              {password && (
                <div className="flex items-center gap-2" aria-live="polite">
                  <div className="flex flex-1 gap-1">
                    {[1, 2, 3].map((i) => (
                      <span
                        key={i}
                        className="h-1.5 flex-1 rounded-full bg-muted"
                        style={i <= strength.level ? { backgroundColor: STRENGTH_COLOR[strength.level] } : undefined}
                      />
                    ))}
                  </div>
                  <span className="w-12 text-right text-xs font-medium" style={{ color: STRENGTH_COLOR[strength.level] }}>
                    {strength.label}
                  </span>
                </div>
              )}

              {errors.password ? (
                <p id={fid('password-error')} role="alert" className="text-xs font-medium text-destructive">{errors.password}</p>
              ) : (
                <p id={fid('password-hint')} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Use Generate for a strong one. You&apos;ll see it again on the next screen to share it.
                </p>
              )}
            </div>

            {serverError && (
              <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">
                {serverError}
              </p>
            )}

            <DialogFooter className="mx-0 mb-0 rounded-none border-0 bg-transparent p-0">
              <Button type="button" variant="outline" className="h-10" disabled={isSaving} onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" className="h-10 min-w-[140px]" loading={isSaving}>
                {isSaving ? 'Creating…' : 'Create admin'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
