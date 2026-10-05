import { getAdmins } from '@/lib/get-admins';
import { getAdminSession } from '@/lib/get-admin-session';
import { AdminsTable } from '@/components/admins-table';
import { PageHeader } from '@/components/page-header';

export default async function AdminsPage() {
  const [admins, session] = await Promise.all([getAdmins(), getAdminSession()]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admins"
        description={`${admins.length} admin${admins.length === 1 ? '' : 's'} with dashboard access`}
      />
      <AdminsTable admins={admins} currentUid={session?.uid ?? ''} />
    </div>
  );
}
