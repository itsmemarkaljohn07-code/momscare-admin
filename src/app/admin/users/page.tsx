import { getUsers } from '@/lib/get-users';
import { UsersTable } from '@/components/users-table';
import { PageHeader } from '@/components/page-header';

export default async function UsersListPage() {
  const users = await getUsers();

  return (
    <div className="space-y-4">
            <PageHeader title="Users" description={`${users.length} registered accounts`} />
      <UsersTable users={users} />
    </div>
  );
}