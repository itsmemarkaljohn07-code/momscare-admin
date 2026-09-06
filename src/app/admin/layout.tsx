import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/get-admin-session';
import { LogoutButton } from '@/components/logout-button';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <div>
      <header className="flex items-center justify-between border-b p-4">
        <span className="text-sm text-muted-foreground">
          Signed in as {session.email}
        </span>
        <LogoutButton />
      </header>
      <main>{children}</main>
    </div>
  );
}