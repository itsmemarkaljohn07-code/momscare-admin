import { getAppointmentStats } from '@/lib/get-appointment-stats';
import { getUsers } from '@/lib/get-users';
import { getDoctors } from '@/lib/get-doctors';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { CalendarClock, CalendarCheck, CalendarX, CalendarDays } from 'lucide-react';
import { AdminAppointmentsLive } from '@/components/admin-appointments-live';

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const [{ appointments, stats }, users, doctors, params] = await Promise.all([
    getAppointmentStats(),
    getUsers(),
    getDoctors(),
    searchParams,
  ]);
  const view = params.tab === 'requests' ? 'requests' : 'scheduled';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Appointments"
        description="Patients' requests and every scheduled appointment."
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total" value={stats.total} icon={CalendarDays} color="pink" />
        <StatCard label="Upcoming" value={stats.upcoming} icon={CalendarClock} color="purple" />
        <StatCard label="Completed" value={stats.completed} icon={CalendarCheck} color="mint" />
        <StatCard label="Cancelled" value={stats.cancelled} icon={CalendarX} color="amber" />
      </div>

      {/* Keyed on the tab, so following the sidebar's Requests link while
          already on this page switches to it. */}
      <AdminAppointmentsLive key={view} users={users} doctors={doctors} initial={appointments} initialView={view} />
    </div>
  );
}
