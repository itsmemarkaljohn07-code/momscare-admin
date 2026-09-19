'use client';

import { useState } from 'react';
import { Users as UsersIcon, Stethoscope, UserCheck, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/stat-card';
import { UsersTable } from '@/components/users-table';
import { DoctorsTable } from '@/components/doctors-table';
import type { AdminUserView } from '@/lib/get-users';
import type { DoctorRecord } from '@/lib/get-doctors';

type Tab = 'patients' | 'doctors';

export function PatientsDoctorsView({
  users,
  doctors,
}: {
  users: AdminUserView[];
  doctors: DoctorRecord[];
}) {
  const [tab, setTab] = useState<Tab>('patients');

  const active = users.filter((u) => !u.disabled).length;
  const suspended = users.filter((u) => u.disabled).length;
  const withLogin = doctors.filter((d) => !!d.authUid).length;

  return (
    <div className="space-y-5">
      {/* Tab switcher */}
      <div className="flex flex-col gap-1 sm:inline-flex sm:flex-row sm:rounded-lg sm:border sm:bg-muted/40 sm:p-1">
        <Button
          type="button"
          variant={tab === 'patients' ? 'default' : 'ghost'}
          size="sm"
          className="justify-start gap-1.5 sm:justify-center"
          onClick={() => setTab('patients')}
        >
          <UsersIcon className="h-3.5 w-3.5 shrink-0" />
          Patient Accounts
          <span className="ml-0.5 rounded-full bg-background/60 px-1.5 text-xs font-normal">
            {users.length}
          </span>
        </Button>
        <Button
          type="button"
          variant={tab === 'doctors' ? 'default' : 'ghost'}
          size="sm"
          className="justify-start gap-1.5 sm:justify-center"
          onClick={() => setTab('doctors')}
        >
          <Stethoscope className="h-3.5 w-3.5 shrink-0" />
          <span className="sm:hidden">Doctor Accounts</span>
          <span className="hidden sm:inline">Doctor / Healthcare Provider Accounts</span>
          <span className="ml-0.5 rounded-full bg-background/60 px-1.5 text-xs font-normal">
            {doctors.length}
          </span>
        </Button>
      </div>

      {tab === 'patients' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <StatCard label="Total Patients" value={users.length} icon={UsersIcon} color="pink" />
            <StatCard label="Active" value={active} icon={UserCheck} color="mint" />
            <StatCard label="Suspended" value={suspended} icon={UserX} color="amber" />
          </div>
          <UsersTable users={users} />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <StatCard label="Total Doctors" value={doctors.length} icon={Stethoscope} color="purple" />
            <StatCard label="With Login Access" value={withLogin} icon={UserCheck} color="mint" />
            <StatCard label="No Login Yet" value={doctors.length - withLogin} icon={UserX} color="amber" />
          </div>
          <DoctorsTable doctors={doctors} />
        </div>
      )}
    </div>
  );
}