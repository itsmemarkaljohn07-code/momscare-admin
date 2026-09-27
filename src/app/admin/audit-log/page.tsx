import { getAuditLogs } from '@/lib/get-audit-logs';
import { PageHeader } from '@/components/page-header';
import { AuditLogTable } from '@/components/audit-log-table';

export default async function AuditLogPage() {
  const logs = await getAuditLogs();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        description="A record of significant actions across the dashboard — who did what, and when."
      />
      <AuditLogTable logs={logs} />
    </div>
  );
}
