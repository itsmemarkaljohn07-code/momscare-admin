'use client';

import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase-client';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { showFriendlyError } from '@/lib/error-messages';

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    try {
      await signOut(auth);
      await fetch('/api/session', { method: 'DELETE' });
      router.push('/login');
    } catch (err) {
      showFriendlyError(err, 'logout');
      // Still navigate — the client-side sign-out has very likely
      // already succeeded even if the server-side cookie cleanup
      // request failed, so leaving the person on a stale dashboard
      // page would be more confusing than sending them to /login.
      router.push('/login');
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleLogout}
      className="group gap-1.5 transition-colors duration-200 ease-out hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive active:bg-destructive/15"
    >
      <LogOut className="h-3.5 w-3.5 shrink-0 transition-colors duration-200 ease-out group-hover:text-destructive" />
      <span>Log out</span>
    </Button>
  );
}