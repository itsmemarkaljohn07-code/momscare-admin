import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/get-admin-session';
import { getPendingCancellationCount } from '@/lib/get-appointments';
import { AppSidebar } from '@/components/admin-sidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { GlobalSearch } from '@/components/global-search';
import { AdminNotificationBell } from '@/components/admin-notification-bell';

// Everything under this layout shows live, signed-in data, so it must be
// rendered on every request — never captured once when the app is built.
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();

  if (!session) {
    redirect('/login');
  }

  const pendingCancellations = await getPendingCancellationCount();

  return (
    <SidebarProvider>
      <AppSidebar pendingCancellations={pendingCancellations} />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b bg-background/80 px-4 shadow-soft backdrop-blur-sm sm:px-6">
          <div className="flex shrink-0 items-center gap-2">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-5" />
          </div>
          <div className="min-w-0 max-w-md flex-1">
            <GlobalSearch />
          </div>
          <span className="hidden shrink-0 text-sm text-muted-foreground lg:inline">
            Signed in as {session.email}
          </span>
          <div className="ml-auto shrink-0">
            <AdminNotificationBell />
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}