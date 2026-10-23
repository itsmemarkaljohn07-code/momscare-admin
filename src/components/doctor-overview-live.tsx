'use client';

import Link from 'next/link';
import { Users, CalendarClock, Clock, Camera } from 'lucide-react';
import { StatCard } from '@/components/stat-card';
import { AppointmentStatus, StatusBadge } from '@/components/status-badge';
import { DecidedByAdminNote } from '@/components/admin-approval-controls';
import { DoctorLiveNotice, useDoctorLiveAppointments } from '@/components/doctor-live-appointments';
import { isPendingDoctorApproval } from '@/lib/appointment-status';
import { formatDateKey } from '@/lib/pregnancy-display';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DoctorAppointmentView } from '@/lib/get-doctor-appointments';

// The Overview's appointment numbers and lists, from the doctor layout's
// live list, so they follow admin changes without a reload.

function useOverviewAppointments() {
  const list: DoctorAppointmentView[] = useDoctorLiveAppointments()?.appointments ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = list.filter((a) => a.status === 'upcoming' && a.date >= today);
  return { upcoming, pending: list.filter(isPendingDoctorApproval) };
}

/** Stat cards and the "awaiting your response" banner. */
export function DoctorOverviewStats({ patients, snapshots }: { patients: number; snapshots: number }) {
  const { upcoming, pending } = useOverviewAppointments();
  return (
    <>
      <DoctorLiveNotice />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Assigned Patients" value={patients} icon={Users} color="pink" />
        <StatCard label="Upcoming Appointments" value={upcoming.length} icon={CalendarClock} color="purple" />
        <StatCard label="Pending Requests" value={pending.length} icon={Clock} color="amber" />
        <StatCard label="Recent Snapshots" value={snapshots} icon={Camera} color="mint" />
      </div>

      {pending.length > 0 && (
        <Card
          className="border"
          style={{ borderColor: 'var(--status-pending)', backgroundColor: 'var(--status-pending-bg)' }}
        >
          <CardContent className="flex flex-col items-start justify-between gap-2 p-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-semibold">
                {pending.length} appointment{pending.length === 1 ? '' : 's'} awaiting your response
              </p>
              <p className="text-xs text-muted-foreground">
                Review and approve or reject pending appointment requests.
              </p>
            </div>
            <Link href="/doctor/appointments" className="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring -mx-2">
              Review now →
            </Link>
          </CardContent>
        </Card>
      )}
    </>
  );
}

/** The next five upcoming appointments. */
export function DoctorUpcomingCard() {
  const nextAppointments = useOverviewAppointments().upcoming.slice(0, 5);
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Upcoming Appointments</CardTitle>
        <Link href="/doctor/appointments" className="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring -my-2 -mr-2">
          View all
        </Link>
      </CardHeader>
      <CardContent>
        {nextAppointments.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
            <CalendarClock className="h-6 w-6" aria-hidden="true" />
            No upcoming appointments.
          </div>
        ) : (
          <div className="space-y-1">
            {nextAppointments.map((a) => (
              <div key={`${a.patientUid}/${a.id}`} className="flex flex-col gap-2 rounded-md p-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium" title={a.patientName}>{a.patientName}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.label} · {formatDateKey(a.date, { weekday: 'short', month: 'short', day: 'numeric' })} · {a.time}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1 sm:shrink-0 sm:justify-end">
                  <span className="inline-flex flex-col items-end">
                    <StatusBadge status={a.doctorApproval} />
                    {a.doctorApproval !== 'pending' && a.decidedBy === 'admin' && <DecidedByAdminNote />}
                  </span>
                  {(a.cancellation?.state === 'requested' || a.cancellation?.state === 'declined') && (
                    <AppointmentStatus appointment={a} />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
