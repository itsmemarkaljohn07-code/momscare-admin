import { getUsers } from '@/lib/get-users';
import { getDoctors } from '@/lib/get-doctors';
import { PatientsDoctorsView } from '@/components/patients-doctors-view';
import { PageHeader } from '@/components/page-header';

export default async function UsersListPage() {
  const [users, doctors] = await Promise.all([getUsers(), getDoctors()]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description={`${users.length} patients · ${doctors.length} doctors`}
      />
      <PatientsDoctorsView users={users} doctors={doctors} />
    </div>
  );
}