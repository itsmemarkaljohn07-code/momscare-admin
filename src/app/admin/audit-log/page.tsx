import { getAuditLogPage } from '@/lib/get-audit-logs';
import { PageHeader } from '@/components/page-header';
import { AuditLogTable } from '@/components/audit-log-table';
import { ActivityReportDownload } from '@/components/activity-report-download';

export default async function AuditLogPage() {
  const initial = await getAuditLogPage();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        description="Who did what in the dashboard, and when. Read-only."
      />
      <ActivityReportDownload />
      <AuditLogTable initial={initial} />
    </div>
  );
}
