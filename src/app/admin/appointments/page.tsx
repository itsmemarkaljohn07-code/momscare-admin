import { getAppointments } from '@/lib/get-appointments';
import { getUsers } from '@/lib/get-users';
import { AppointmentsTable } from '@/components/appointments-table';
import { PageHeader } from '@/components/page-header';

export default async function AppointmentsPage() {
  const [appointments, users] = await Promise.all([getAppointments(), getUsers()]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Appointments"
        description={`${appointments.length} total appointments across all patients`}
      />
      <AppointmentsTable appointments={appointments} users={users} />
    </div>
  );
}