import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/get-admin-session';
import { AppSidebar } from '@/components/admin-sidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { GlobalSearch } from '@/components/global-search';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <SidebarProvider>
      <AppSidebar />
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
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}