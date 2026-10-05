import { redirect } from 'next/navigation';
import { getDoctorSession } from '@/lib/get-doctor-session';
import { getDoctorAppointments } from '@/lib/get-doctor-appointments';
import { DoctorSidebar } from '@/components/doctor-sidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';

// Everything under this layout shows live, signed-in data, so it must be
// rendered on every request — never captured once when the app is built.
export const dynamic = 'force-dynamic';

export default async function DoctorLayout({ children }: { children: React.ReactNode }) {
  const session = await getDoctorSession();

  if (!session) {
    redirect('/login');
  }

  const appointments = await getDoctorAppointments(session.doctorName);
  const pendingCount = appointments.filter((a) => a.doctorApproval === 'pending').length;

  return (
    <SidebarProvider>
      <DoctorSidebar doctorId={session.doctorId} doctorName={session.doctorName} pendingCount={pendingCount} />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-16 items-center gap-2 border-b bg-background/80 px-4 shadow-soft backdrop-blur-sm sm:px-6">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-5" />
          <span className="text-sm text-muted-foreground">Signed in as {session.email}</span>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}