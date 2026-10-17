'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from '@/components/theme-toggle';
import { Eye, EyeOff, User, Lock, Loader2 } from 'lucide-react';
import { Petit_Formal_Script } from 'next/font/google';

const scriptFont = Petit_Formal_Script({ weight: '400', subsets: ['latin'], display: 'swap' });

// The only messages the form ever shows: no server text, no stack traces.
const MESSAGES = {
  credentials: 'Incorrect email, username or password.',
  network: 'No internet connection. Check your connection and try again.',
  disabled: 'This account has been disabled. Please contact the clinic administrator.',
  noAccess: "This account doesn't have access to the dashboard.",
  tooMany: 'Too many attempts. Please wait a few minutes and try again.',
  unknown: 'Something went wrong. Please try again.',
};

/** Thrown inside the sign-in flow to end it with one of MESSAGES. */
class LoginError extends Error {
  constructor(readonly userMessage: string) {
    super(userMessage);
  }
}

function messageFor(err: unknown): string {
  if (err instanceof LoginError) return err.userMessage;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return MESSAGES.network;
  const code = (err as { code?: unknown })?.code;
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return MESSAGES.credentials;
    case 'auth/user-disabled':
      return MESSAGES.disabled;
    case 'auth/too-many-requests':
      return MESSAGES.tooMany;
    case 'auth/network-request-failed':
      return MESSAGES.network;
  }
  // fetch() rejects with a TypeError when the network is down.
  if (err instanceof TypeError) return MESSAGES.network;
  return MESSAGES.unknown;
}

/** Asks one session route to accept the signed-in user. Returns true on
 *  success, false when the route says this account isn't that role. */
async function tryCreateSession(endpoint: string, idToken: string): Promise<boolean> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (res.ok) return true;
  if (res.status === 403) return false;
  throw new LoginError(MESSAGES.unknown);
}

// Real photography — served from /public/login-slides/. Swap these
// paths any time; nothing else below needs to change.
const SLIDES = [
  '/login-slides/slide-1.jpg',
  '/login-slides/slide-2.jpg',
  '/login-slides/slide-3.jpg',
  '/login-slides/slide-4.jpg',
  '/login-slides/slide-5.jpg',
];
const SLIDE_INTERVAL_MS = 5000;

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setSlideIndex((i) => (i + 1) % SLIDES.length);
    }, SLIDE_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  /** An email if the input has "@", otherwise a doctor username that the
   *  server resolves to the doctor's login email. */
  async function resolveEmail(input: string): Promise<string> {
    if (input.includes('@')) return input;

    const res = await fetch('/api/doctor-username-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: input }),
    });
    if (res.status === 404 || res.status === 400) throw new LoginError(MESSAGES.credentials);
    if (res.status === 429) throw new LoginError(MESSAGES.tooMany);
    if (!res.ok) throw new LoginError(MESSAGES.unknown);
    const data = (await res.json()) as { email?: string };
    if (!data.email) throw new LoginError(MESSAGES.credentials);
    return data.email;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isLoading) return;
    setError('');
    setIsLoading(true);

    let signedIn = false;
    try {
      const loginEmail = await resolveEmail(identifier.trim());
      const cred = await signInWithEmailAndPassword(auth, loginEmail, password);
      signedIn = true;
      const idToken = await cred.user.getIdToken();

      // The server decides the role: admin first (admins collection),
      // then doctor (custom claim). Each route clears the other role's
      // cookie when it accepts.
      if (await tryCreateSession('/api/session', idToken)) {
        router.push('/admin');
        return;
      }
      if (await tryCreateSession('/api/doctor-session', idToken)) {
        router.push('/doctor');
        return;
      }
      throw new LoginError(MESSAGES.noAccess);
    } catch (err: unknown) {
      if (signedIn) await signOut(auth).catch(() => {});
      setError(messageFor(err));
      setIsLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen bg-background">
      <div className="absolute right-4 top-4 z-20 lg:right-6 lg:top-6">
        <ThemeToggle />
      </div>

      {/* Decorative brand panel — hidden below lg; a phone doesn't have
          room for a side panel and the form both, so mobile gets the
          form at full width instead. */}
      <div className="relative hidden overflow-hidden lg:flex lg:w-[45%] lg:flex-col lg:justify-between lg:p-10 xl:w-2/5 xl:p-12">
        {/* Sliding background layer: every slide is stacked and
            absolutely positioned, cross-fading via opacity — this
            avoids any layout shift, since nothing ever changes size
            or position, only opacity. */}
        {SLIDES.map((src, i) => (
          <div
            key={i}
            aria-hidden="true"
            className="absolute inset-0 scale-110 bg-cover bg-center transition-opacity duration-1000 ease-in-out"
            style={{ backgroundImage: `url(${src})`, opacity: i === slideIndex ? 1 : 0, filter: 'blur(3px)' }}
          />
        ))}

        {/* Gradient scrim, darkest at top/bottom where text sits, so
            contrast holds consistently across every slide without
            needing a different text color per photo. */}
        <div
          className="absolute inset-0"
          aria-hidden="true"
          style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 35%, rgba(0,0,0,0.25) 65%, rgba(0,0,0,0.6) 100%)' }}
        />

        <div className="pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-10 h-80 w-80 rounded-full bg-white/10 blur-3xl" />

        {/* Everything below is layered above the slides/overlay via
            z-10, and never moves or fades with the background. */}
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-4">
          <p
            className={`${scriptFont.className} text-center text-6xl leading-none text-white xl:text-7xl`}
            style={{ textShadow: '0 2px 12px rgba(0,0,0,0.45)' }}
          >
            MomCare
          </p>
        </div>

        <div className="relative z-10 space-y-3 text-white" style={{ textShadow: '0 1px 6px rgba(0,0,0,0.4)' }}>
          <p className="text-2xl font-semibold leading-snug xl:text-3xl">
            Supporting every step of the journey to motherhood.
          </p>
          <p className="text-sm text-white/90">
            A connected space for administrators and healthcare providers to
            care for every patient.
          </p>
        </div>

        <div
          className="relative z-10 flex items-center justify-between pt-6 text-white/80"
          style={{ textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}
        >
          <p className="text-xs">
            © {new Date().getFullYear()} MomCare. All rights reserved.
          </p>
          <div className="flex items-center gap-1.5">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSlideIndex(i)}
                aria-label={`Show background ${i + 1} of ${SLIDES.length}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === slideIndex ? 'w-5 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/60'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:p-10">
        <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="mb-8 space-y-1 text-center lg:text-left">
            <p className={`${scriptFont.className} mb-3 text-4xl text-primary lg:hidden`}>MomCare</p>
            <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
            <p className="text-sm text-muted-foreground">
              Sign in to the MomCare clinic dashboard
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="login-identifier" className="text-sm font-medium">
                Email or username
              </label>
              <div className="relative">
                <User
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="login-identifier"
                  name="username"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="you@example.com or username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? 'login-error' : undefined}
                  disabled={isLoading}
                  className="h-11 rounded-full pl-10 text-base focus-visible:ring-2 focus-visible:ring-primary/50"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="login-password" className="text-sm font-medium">
                Password
              </label>
              <div className="relative">
                <Lock
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? 'login-error' : undefined}
                  disabled={isLoading}
                  className="h-11 rounded-full pl-10 pr-12 text-base focus-visible:ring-2 focus-visible:ring-primary/50"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  aria-controls="login-password"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div aria-live="polite" role="status">
              {error && (
                <p
                  id="login-error"
                  className="animate-in fade-in slide-in-from-top-1 rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700 duration-200 dark:bg-red-950/30 dark:text-red-300"
                >
                  {error}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="h-11 w-full rounded-full text-base transition-transform focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 active:scale-[0.98]"
              disabled={isLoading}
              aria-busy={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}