import { getAppointmentStats } from '@/lib/get-appointment-stats';
import { getDoctors } from '@/lib/get-doctors';
import { AppointmentReports } from '@/components/appointment-reports';
import { PageHeader } from '@/components/page-header';
import { ReportDownloads } from '@/components/report-downloads';
import { PrenatalReportPanel } from '@/components/prenatal-report-panel';

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
      <PrenatalReportPanel />
      <AppointmentReports appointments={appointments} doctors={doctors} />
    </div>
  );
}