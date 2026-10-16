'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from '@/components/theme-toggle';
import { Eye, EyeOff, User, Mail, Lock } from 'lucide-react';
import { getFriendlyError, getApiErrorMessage } from '@/lib/error-messages';
import { Petit_Formal_Script } from 'next/font/google';

const scriptFont = Petit_Formal_Script({ weight: '400', subsets: ['latin'], display: 'swap' });

type Role = 'admin' | 'doctor';

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
  const [role, setRole] = useState<Role>('admin');
  const [email, setEmail] = useState('');
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

  function switchRole(next: Role) {
    if (next === role) return;
    setRole(next);
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      let loginEmail = email;

      if (role === 'doctor') {
        const lookupRes = await fetch('/api/doctor-username-lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: email }),
        });
        if (!lookupRes.ok) {
          // A failed username lookup means no such account — same
          // "Account Not Found" wording as a failed sign-in would get,
          // for consistency between the two login paths.
          setError(getFriendlyError({ code: 'auth/user-not-found' }, 'doctor username lookup').description);
          setIsLoading(false);
          return;
        }
        const lookupData = await lookupRes.json();
        loginEmail = lookupData.email;
      }

      const cred = await signInWithEmailAndPassword(auth, loginEmail, password);
      const idToken = await cred.user.getIdToken();

      const endpoint = role === 'admin' ? '/api/session' : '/api/doctor-session';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        // A 403 here specifically means the sign-in itself succeeded,
        // but this Firebase account isn't provisioned for the role
        // being requested — that's a clear, correct explanation on
        // its own, not an unexpected failure to genericize away.
        if (res.status === 403 && data?.error) {
          setError(data.error);
        } else {
          setError(getApiErrorMessage(res, data, undefined, 'create session').description);
        }
        setIsLoading(false);
        return;
      }

      router.push(role === 'admin' ? '/admin' : '/doctor');
    } catch (err: unknown) {
      setError(getFriendlyError(err, 'login').description);
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
      <div className="flex flex-1 items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="mb-8 space-y-1 text-center lg:text-left">
            <p className={`${scriptFont.className} mb-3 text-4xl text-primary lg:hidden`}>MomCare</p>
            <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
            <p className="text-sm text-muted-foreground transition-opacity duration-300">
              {role === 'admin' ? 'Sign in to manage the dashboard' : 'Sign in to view your patients'}
            </p>
          </div>

          <div className="relative mb-6 flex w-full rounded-full border bg-muted/50 p-1">
            <div
              className="absolute inset-y-1 w-[calc(50%-4px)] rounded-full bg-background shadow-sm transition-transform duration-300 ease-out"
              style={{ transform: role === 'doctor' ? 'translateX(calc(100% + 4px))' : 'translateX(0%)' }}
            />
            <button
              type="button"
              onClick={() => switchRole('admin')}
              className={`relative z-10 flex-1 rounded-full py-2 text-sm font-medium transition-colors duration-300 ${
                role === 'admin' ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              Admin
            </button>
            <button
              type="button"
              onClick={() => switchRole('doctor')}
              className={`relative z-10 flex-1 rounded-full py-2 text-sm font-medium transition-colors duration-300 ${
                role === 'doctor' ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              Doctor
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{role === 'admin' ? 'Email' : 'Username'}</label>
              <div className="relative">
                {role === 'admin' ? (
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                ) : (
                  <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                )}
                <Input
                  type={role === 'admin' ? 'email' : 'text'}
                  placeholder={role === 'admin' ? 'you@example.com' : 'yourusername'}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 rounded-full pl-10 transition-shadow focus-visible:ring-2 focus-visible:ring-primary/30"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Password</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 rounded-full pl-10 pr-11 transition-shadow focus-visible:ring-2 focus-visible:ring-primary/30"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="animate-in fade-in slide-in-from-top-1 rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-600 duration-200 dark:bg-red-950/30 dark:text-red-400">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="h-11 w-full rounded-full text-base transition-transform active:scale-[0.98]"
              disabled={isLoading}
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}