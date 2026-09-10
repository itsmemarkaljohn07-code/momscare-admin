import { getDoctors } from '@/lib/get-doctors';
import { DoctorsTable } from '@/components/doctors-table';
import { DoctorFormDialog } from '@/components/doctor-form-dialog';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';

export default async function DoctorsPage() {
  const doctors = await getDoctors();

  return (
    <div className="space-y-4">
      <PageHeader
        title="Doctors"
        description={`${doctors.length} doctors on the roster`}
        action={<DoctorFormDialog trigger={<Button>+ Add Doctor</Button>} />}
      />
      <DoctorsTable doctors={doctors} />
    </div>
  );
}