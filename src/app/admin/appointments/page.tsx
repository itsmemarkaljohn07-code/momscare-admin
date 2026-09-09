import { getAppointmentStats } from '@/lib/get-appointment-stats';
import { getUsers } from '@/lib/get-users';
import { AppointmentsTable } from '@/components/appointments-table';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { CalendarClock, CalendarCheck, CalendarX, CalendarDays } from 'lucide-react';

export default async function AppointmentsPage() {
  const [{ appointments, stats }, users] = await Promise.all([
    getAppointmentStats(),
    getUsers(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Appointments"
        description={`${stats.total} total appointments across all patients`}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total" value={stats.total} icon={CalendarDays} color="pink" />
        <StatCard label="Upcoming" value={stats.upcoming} icon={CalendarClock} color="purple" />
        <StatCard label="Completed" value={stats.completed} icon={CalendarCheck} color="mint" />
        <StatCard label="Cancelled" value={stats.cancelled} icon={CalendarX} color="amber" />
      </div>

      <AppointmentsTable appointments={appointments} users={users} />
    </div>
  );
}