import { redirect } from 'next/navigation';
import { getDoctorSession } from '@/lib/get-doctor-session';
import { getDoctorById } from '@/lib/get-doctors';
import { DoctorProfileForm } from '@/components/doctor-profile-form';
import { PageHeader } from '@/components/page-header';

export default async function DoctorProfilePage() {
  const session = await getDoctorSession();
  if (!session) redirect('/login');

  const doctor = await getDoctorById(session.doctorId);
  if (!doctor) redirect('/login');

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="My Profile" description="Manage how you appear across MomCare" />
      <DoctorProfileForm initial={doctor} />
    </div>
  );
}