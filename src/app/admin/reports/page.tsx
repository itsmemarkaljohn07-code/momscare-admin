import { getAppointmentStats } from '@/lib/get-appointment-stats';
import { getDoctors } from '@/lib/get-doctors';
import { AppointmentReports } from '@/components/appointment-reports';
import { PageHeader } from '@/components/page-header';
import { ReportDownloads } from '@/components/report-downloads';

export default async function ReportsPage() {
  const [{ appointments }, doctors] = await Promise.all([
    getAppointmentStats(),
    getDoctors(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Filter and analyze appointment data across the whole clinic"
      />
      <ReportDownloads />
      <AppointmentReports appointments={appointments} doctors={doctors} />
    </div>
  );
}