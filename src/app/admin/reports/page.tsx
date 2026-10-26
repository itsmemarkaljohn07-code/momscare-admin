import { getAppointmentStats } from '@/lib/get-appointment-stats';
import { getDoctors } from '@/lib/get-doctors';
import { AppointmentReports } from '@/components/appointment-reports';
import { PageHeader } from '@/components/page-header';
import { ReportDownloads } from '@/components/report-downloads';
import { ClinicReports } from '@/components/clinic-reports';

export default async function ReportsPage() {
  const [{ appointments }, doctors] = await Promise.all([
    getAppointmentStats(),
    getDoctors(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="The clinic's monthly reports, then appointment and patient reports for the whole clinic."
      />
      <ClinicReports />

      <section aria-labelledby="other-reports" className="space-y-4 border-t pt-6">
        <h2 id="other-reports" className="text-lg font-semibold">Other reports</h2>
        <ReportDownloads />
        <AppointmentReports appointments={appointments} doctors={doctors} />
      </section>
    </div>
  );
}