import { DoctorAppointmentsLive } from '@/components/doctor-appointments-live';

// The list comes from the doctor layout's live store (one server read per
// request there, then one listener per appointment for every doctor page).
export default function DoctorAppointmentsPage() {
  return <DoctorAppointmentsLive />;
}
