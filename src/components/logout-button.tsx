'use client';

import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase-client';
import { Button } from '@/components/ui/button';

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await signOut(auth);
    await fetch('/api/session', { method: 'DELETE' });
    router.push('/login');
  }

  return (
    <Button variant="outline" size="sm" onClick={handleLogout}>
      Log out
    </Button>
  );
}