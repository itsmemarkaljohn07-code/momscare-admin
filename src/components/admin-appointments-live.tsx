'use client';

import { useState, useMemo } from 'react';
import type { DocumentData } from 'firebase/firestore';
import { CalendarClock, CalendarX2, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppointmentsTable } from '@/components/appointments-table';
import { AppointmentHistoryTable } from '@/components/appointment-history-table';
import { useLiveAppointments } from '@/hooks/use-live-appointments';
import { useLiveAppointmentRequests } from '@/hooks/use-live-appointment-requests';
import { AppointmentRequestsTable } from '@/components/appointment-requests-table';
import { useMarkMissed } from '@/hooks/use-mark-missed';
import { isMissedAppointment } from '@/lib/appointment-status';
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

export type AppointmentsView = 'requests' | 'scheduled';

export function AdminAppointmentsLive({
  users,
  doctors,
  initial,
  initialView = 'scheduled',
}: {
  users: AdminUserView[];
  doctors: DoctorRecord[];
  initial: AdminAppointment[];
  /** Which top tab opens first (?tab=requests). */
  initialView?: AppointmentsView;
}) {
  // Per-document listeners over the server list; see useLiveAppointments.
  const list = useLiveAppointments(initial, toAdminView);
  // Patients' appointment requests, live.
  const { requests, loaded: requestsLoaded } = useLiveAppointmentRequests();
  const pendingRequests = requests.filter((r) => r.status === 'pending').length;
  const [view, setView] = useState<AppointmentsView>(initialView);
  const [tab, setTab] = useState<Tab>('active');
  // Re-checked every minute; 3 hours after their start, appointments are
  // stored as missed and the patient is notified (useMarkMissed).
  const now = useMarkMissed(list);

  const activeList = useMemo(
    () => list.filter((a) => a.status === 'upcoming' && !isMissedAppointment(a, now)),
    [list, now]
  );
  const requestsList = useMemo(() => list.filter(isCancellationRequested), [list]);
  const historyList = useMemo(
    () => list.filter((a) => a.status === 'completed' || a.status === 'cancelled' || isMissedAppointment(a, now)),
    [list, now]
  );

  function switchView(next: AppointmentsView) {
    setView(next);
    // Keep the address in step, so a reload or shared link opens this tab.
    const url = new URL(window.location.href);
    if (next === 'requests') url.searchParams.set('tab', 'requests');
    else url.searchParams.delete('tab');
    window.history.replaceState(null, '', url);
  }

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Appointments" className="flex gap-6 border-b">
        {(['requests', 'scheduled'] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => switchView(v)}
            className={`-mb-px flex items-center gap-2 border-b-2 px-1 pb-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
              view === v ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {v === 'requests' ? 'Requests' : 'Scheduled'}
            {v === 'requests' && (
              <span
                className="rounded-full px-2 py-0.5 text-xs font-medium"
                style={
                  pendingRequests > 0
                    ? { backgroundColor: 'var(--status-pending-bg)', color: 'var(--status-pending)' }
                    : undefined
                }
              >
                {pendingRequests} pending
              </span>
            )}
          </button>
        ))}
      </div>

      {view === 'requests' ? (
        <AppointmentRequestsTable
          requests={requests}
          loaded={requestsLoaded}
          users={users}
          doctors={doctors}
          appointments={list}
        />
      ) : (
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
          showNewAppointment={false}
        />
      ) : (
        <AppointmentHistoryTable appointments={historyList} doctors={doctors} />
      )}
    </div>
      )}
    </div>
  );
}