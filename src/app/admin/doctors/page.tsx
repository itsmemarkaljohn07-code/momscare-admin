import { getDoctors } from '@/lib/get-doctors';
import { DoctorsTable } from '@/components/doctors-table';
import { DoctorAccountFormDialog } from '@/components/doctor-account-form-dialog';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';

export default async function DoctorsPage() {
  const doctors = await getDoctors();

  return (
    <div className="space-y-4">
      <PageHeader
        title="Doctors"
        description={`${doctors.length} doctors on the roster`}
        action={<DoctorAccountFormDialog trigger={<Button>+ Add Doctor Account</Button>} />}
      />
      <DoctorsTable doctors={doctors} />
    </div>
  );
}