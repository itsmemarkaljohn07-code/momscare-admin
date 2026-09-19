'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeToggle } from '@/components/theme-toggle';
import { Eye, EyeOff } from 'lucide-react';

type Role = 'admin' | 'doctor';

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>('admin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
          setError('Invalid username or password.');
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
        const data = await res.json().catch(() => ({}));
        setError(
          data.error ||
            (role === 'admin'
              ? 'This account does not have admin access.'
              : 'This account does not have healthcare provider access.')
        );
        setIsLoading(false);
        return;
      }

      router.push(role === 'admin' ? '/admin' : '/doctor');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
      setIsLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-muted/30 p-4 sm:p-6">
      <div className="pointer-events-none absolute -left-24 -top-24 h-56 w-56 rounded-full bg-[#e07eb8]/20 blur-3xl sm:h-72 sm:w-72" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-56 w-56 rounded-full bg-[#9b6fc4]/20 blur-3xl sm:h-72 sm:w-72" />

      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <Card className="animate-in fade-in slide-in-from-bottom-4 relative w-full max-w-sm shadow-lg duration-500">
        <CardHeader className="items-center space-y-4 text-center">
          <CardTitle className="text-xl">MomsCare</CardTitle>

          <div className="relative flex w-full rounded-lg border bg-muted/50 p-1">
            <div
              className="absolute inset-y-1 w-[calc(50%-4px)] rounded-md bg-background shadow-sm transition-transform duration-300 ease-out"
              style={{ transform: role === 'doctor' ? 'translateX(calc(100% + 4px))' : 'translateX(0%)' }}
            />
            <button
              type="button"
              onClick={() => switchRole('admin')}
              className={`relative z-10 flex-1 rounded-md py-1.5 text-sm font-medium transition-colors duration-300 ${
                role === 'admin' ? 'text-[#d9609a]' : 'text-muted-foreground'
              }`}
            >
              Admin
            </button>
            <button
              type="button"
              onClick={() => switchRole('doctor')}
              className={`relative z-10 flex-1 rounded-md py-1.5 text-sm font-medium transition-colors duration-300 ${
                role === 'doctor' ? 'text-[#d9609a]' : 'text-muted-foreground'
              }`}
            >
              Doctor
            </button>
          </div>

          <p className="text-sm text-muted-foreground transition-opacity duration-300">
            {role === 'admin' ? 'Sign in to manage the dashboard' : 'Sign in to view your patients'}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{role === 'admin' ? 'Email' : 'Username'}</label>
              <Input
                type={role === 'admin' ? 'email' : 'text'}
                placeholder={role === 'admin' ? 'you@example.com' : 'yourusername'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="transition-shadow focus-visible:ring-2 focus-visible:ring-[#e07eb8]/40"
                required
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Password</label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10 transition-shadow focus-visible:ring-2 focus-visible:ring-[#e07eb8]/40"
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
            </div>
            {error && (
              <p className="animate-in fade-in slide-in-from-top-1 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 duration-200 dark:bg-red-950/30 dark:text-red-400">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full transition-transform active:scale-[0.98]" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}