import { getAppointmentStats } from '@/lib/get-appointment-stats';
import { getUsers } from '@/lib/get-users';
import { getDoctors } from '@/lib/get-doctors';
import { PageHeader } from '@/components/page-header';
import { AppointmentRequestsLive } from '@/components/appointment-requests-live';

export default async function AppointmentRequestsPage() {
  // Patients' names, and the doctors and booked slots the Schedule form needs.
  const [{ appointments }, users, doctors] = await Promise.all([
    getAppointmentStats(),
    getUsers(),
    getDoctors(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Appointment Requests"
        description="Patients ask for an appointment in the app; schedule it with a doctor or decline it."
      />
      <AppointmentRequestsLive users={users} doctors={doctors} appointments={appointments} />
    </div>
  );
}
