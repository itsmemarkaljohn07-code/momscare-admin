import { getUsers } from '@/lib/get-users';
import { UsersTable } from '@/components/users-table';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Users as UsersIcon, UserCheck, UserX } from 'lucide-react';

export default async function UsersListPage() {
  const users = await getUsers();
  const active = users.filter((u) => !u.disabled).length;
  const suspended = users.filter((u) => u.disabled).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Users" description={`${users.length} registered accounts`} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Total Users" value={users.length} icon={UsersIcon} color="pink" />
        <StatCard label="Active" value={active} icon={UserCheck} color="mint" />
        <StatCard label="Suspended" value={suspended} icon={UserX} color="amber" />
      </div>

      <UsersTable users={users} />
    </div>
  );
}