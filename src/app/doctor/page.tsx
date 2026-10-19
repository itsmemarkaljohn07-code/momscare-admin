import Link from 'next/link';
import { getDoctorSession } from '@/lib/get-doctor-session';
import { getDoctorPatients } from '@/lib/get-doctor-patients';
import { getDoctorAppointments } from '@/lib/get-doctor-appointments';
import { getDoctorRecentSnapshots } from '@/lib/get-doctor-recent-snapshots';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { AppointmentStatus, StatusBadge } from '@/components/status-badge';
import { isPendingDoctorApproval } from '@/lib/appointment-status';
import { formatDateKey } from '@/lib/pregnancy-display';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, CalendarClock, Clock, Camera, ChevronRight } from 'lucide-react';

const TYPE_LABELS: Record<string, string> = { bump: 'Bump', ultrasound: 'Ultrasound', milestone: 'Milestone' };

function formatDate(dateIso: string | null): string {
  if (!dateIso) return '';
  return new Date(dateIso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default async function DoctorOverviewPage() {
  const session = await getDoctorSession();
  if (!session) return null;

  const [patients, appointments, recentSnapshots] = await Promise.all([
    getDoctorPatients(session.doctorName),
    getDoctorAppointments(session.doctorName),
    getDoctorRecentSnapshots(session.doctorName, 6),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = appointments.filter((a) => a.status === 'upcoming' && a.date >= today);
  const pendingRequests = appointments.filter(isPendingDoctorApproval);
  const nextAppointments = upcoming.slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeader title="Overview" description={`Welcome back, ${session.doctorName}`} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Assigned Patients" value={patients.length} icon={Users} color="pink" />
        <StatCard label="Upcoming Appointments" value={upcoming.length} icon={CalendarClock} color="purple" />
        <StatCard label="Pending Requests" value={pendingRequests.length} icon={Clock} color="amber" />
        <StatCard label="Recent Snapshots" value={recentSnapshots.length} icon={Camera} color="mint" />
      </div>

      {pendingRequests.length > 0 && (
        <Card
          className="border"
          style={{ borderColor: 'var(--status-pending)', backgroundColor: 'var(--status-pending-bg)' }}
        >
          <CardContent className="flex flex-col items-start justify-between gap-2 p-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-semibold">
                {pendingRequests.length} appointment{pendingRequests.length === 1 ? '' : 's'} awaiting your response
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Recent Snapshots</CardTitle>
            <Link href="/doctor/snapshots" className="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring -my-2 -mr-2">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {recentSnapshots.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
                <Camera className="h-6 w-6" aria-hidden="true" />
                No snapshots uploaded yet.
              </div>
            ) : (
              <div className="space-y-1">
                {recentSnapshots.map((s) => (
                  <Link
                    key={s.photoId}
                    href={`/doctor/${s.patientUid}`}
                    className="flex min-h-11 items-center gap-3 rounded-md p-2 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.imageUrl} alt="Snapshot" className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium" title={s.patientName}>{s.patientName}</p>
                      <p className="text-xs text-muted-foreground">
                        {TYPE_LABELS[s.type] ?? s.type} · Week {s.week} · {formatDate(s.createdAt)}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

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
                  <div key={a.id} className="flex flex-col gap-2 rounded-md p-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium" title={a.patientName}>{a.patientName}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.label} · {formatDateKey(a.date, { weekday: 'short', month: 'short', day: 'numeric' })} · {a.time}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1 sm:shrink-0 sm:justify-end">
                      <StatusBadge status={a.doctorApproval} />
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
      </div>
    </div>
  );
}