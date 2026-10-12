'use client';

import { useState, useMemo } from 'react';
import type { DocumentData } from 'firebase/firestore';
import { CalendarClock, CalendarX2, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppointmentsTable } from '@/components/appointments-table';
import { AppointmentHistoryTable } from '@/components/appointment-history-table';
import { useLiveAppointments } from '@/hooks/use-live-appointments';
import { isCancellationRequested, mapCancellation } from '@/lib/appointment-cancellation';
import type { AdminAppointment } from '@/lib/get-appointments';
import type { AdminUserView } from '@/lib/get-users';
import type { DoctorRecord } from '@/lib/get-doctors';

type Tab = 'active' | 'requests' | 'history';

function toAdminView(base: AdminAppointment, data: DocumentData): AdminAppointment {
  return {
    id: base.id,
    patientUid: base.patientUid,
    patientName: base.patientName,
    label: data.label,
    type: data.type,
    doctor: data.doctor,
    date: data.date,
    time: data.time,
    location: data.location ?? '',
    notes: data.notes ?? '',
    icon: data.icon,
    accentColor: data.accentColor,
    status: data.status,
    doctorApproval: data.doctorApproval ?? 'pending',
    rejectionReason: data.rejectionReason,
    createdAt: data.createdAt?.toDate?.().toISOString() ?? null,
    cancellation: mapCancellation(data.cancellation),
  };
}

export function AdminAppointmentsLive({
  users,
  doctors,
  initial,
}: {
  users: AdminUserView[];
  doctors: DoctorRecord[];
  initial: AdminAppointment[];
}) {
  // Per-document listeners over the server list; see useLiveAppointments.
  const list = useLiveAppointments(initial, toAdminView);
  const [tab, setTab] = useState<Tab>('active');

  const activeList = useMemo(() => list.filter((a) => a.status === 'upcoming'), [list]);
  const requestsList = useMemo(() => list.filter(isCancellationRequested), [list]);
  const historyList = useMemo(
    () => list.filter((a) => a.status === 'completed' || a.status === 'cancelled'),
    [list]
  );

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border bg-muted/40 p-1">
        <Button
          type="button"
          variant={tab === 'active' ? 'default' : 'ghost'}
          size="sm"
          className="gap-1.5"
          onClick={() => setTab('active')}
        >
          <CalendarClock className="h-3.5 w-3.5" />
          Active
          <span className="ml-0.5 rounded-full bg-background/60 px-1.5 text-xs font-normal">
            {activeList.length}
          </span>
        </Button>
        <Button
          type="button"
          variant={tab === 'history' ? 'default' : 'ghost'}
          size="sm"
          className="gap-1.5"
          onClick={() => setTab('history')}
        >
          <History className="h-3.5 w-3.5" />
          History
          <span className="ml-0.5 rounded-full bg-background/60 px-1.5 text-xs font-normal">
            {historyList.length}
          </span>
        </Button>
        <Button
          type="button"
          variant={tab === 'requests' ? 'default' : 'ghost'}
          size="sm"
          className="gap-1.5"
          onClick={() => setTab('requests')}
        >
          <CalendarX2 className="h-3.5 w-3.5" />
          Cancellation requests
          <span
            className={`ml-0.5 rounded-full px-1.5 text-xs font-normal ${requestsList.length > 0 ? '' : 'bg-background/60'}`}
            style={
              requestsList.length > 0
                ? { backgroundColor: 'var(--status-pending-bg)', color: 'var(--status-pending)' }
                : undefined
            }
          >
            {requestsList.length}
          </span>
        </Button>
      </div>

      {tab === 'active' ? (
        <AppointmentsTable appointments={activeList} users={users} doctors={doctors} />
      ) : tab === 'requests' ? (
        <AppointmentsTable
          appointments={requestsList}
          users={users}
          doctors={doctors}
          emptyTitle="No cancellation requests"
          emptyDescription="Requests from patients to cancel an upcoming appointment appear here."
        />
      ) : (
        <AppointmentHistoryTable appointments={historyList} doctors={doctors} />
      )}
    </div>
  );
}