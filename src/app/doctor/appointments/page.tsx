import { getDoctorSession } from '@/lib/get-doctor-session';
import { getDoctorAppointments } from '@/lib/get-doctor-appointments';
import { DoctorAppointmentsLive } from '@/components/doctor-appointments-live';
import { PageHeader } from '@/components/page-header';

export default async function DoctorAppointmentsPage() {
  const session = await getDoctorSession();
  const appointments = session ? await getDoctorAppointments(session.doctorName) : [];

  return (
    <div className="space-y-4">
      <PageHeader title="My Appointments" description={`${appointments.length} appointments booked with you`} />
      {session && <DoctorAppointmentsLive doctorName={session.doctorName} initial={appointments} />}
    </div>
  );
}