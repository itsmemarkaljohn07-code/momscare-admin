import { Stethoscope, UserCheck, UserX } from 'lucide-react';
import { getDoctors } from '@/lib/get-doctors';
import { getDoctorWorkloadData, computeDoctorStats } from '@/lib/doctor-stats';
import { DoctorsTable } from '@/components/doctors-table';
import { DoctorAccountFormDialog } from '@/components/doctor-account-form-dialog';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Button } from '@/components/ui/button';

export default async function DoctorsPage() {
  const [doctors, workload] = await Promise.all([
    getDoctors(),
    // The workload columns are an extra on top of the roster — if
    // reading them fails, the roster still renders and those columns
    // simply show "—".
    getDoctorWorkloadData().catch((err) => {
      console.error('Doctor workload stats unavailable:', err);
      return null;
    }),
  ]);

  const stats = workload ? computeDoctorStats(doctors, workload) : undefined;

  const withLogin = doctors.filter((d) => !!d.authUid).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Doctors"
        description={`${doctors.length} doctors on the roster`}
        action={<DoctorAccountFormDialog trigger={<Button>+ Add Doctor Account</Button>} />}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Total Doctors" value={doctors.length} icon={Stethoscope} color="purple" />
        <StatCard label="With Login Access" value={withLogin} icon={UserCheck} color="mint" />
        <StatCard label="No Login Yet" value={doctors.length - withLogin} icon={UserX} color="amber" />
      </div>

      <DoctorsTable doctors={doctors} stats={stats} />
    </div>
  );
}