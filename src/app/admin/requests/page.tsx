import { redirect } from 'next/navigation';

// Requests now live on the Appointments page; old links keep working.
export default function AppointmentRequestsPage() {
  redirect('/admin/appointments?tab=requests');
}
