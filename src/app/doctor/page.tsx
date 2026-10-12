import Link from 'next/link';
import { getDoctorSession } from '@/lib/get-doctor-session';
import { getDoctorPatients } from '@/lib/get-doctor-patients';
import { getDoctorAppointments } from '@/lib/get-doctor-appointments';
import { getDoctorRecentSnapshots } from '@/lib/get-doctor-recent-snapshots';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { AppointmentStatus, StatusBadge } from '@/components/status-badge';
import { isPendingDoctorApproval } from '@/lib/appointment-status';
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
            <Link href="/doctor/appointments" className="text-sm font-medium text-primary hover:underline">
              Review now →
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Recent Snapshots</CardTitle>
            <Link href="/doctor/snapshots" className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {recentSnapshots.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No snapshots uploaded yet.</p>
            ) : (
              <div className="space-y-1">
                {recentSnapshots.map((s) => (
                  <Link
                    key={s.photoId}
                    href={`/doctor/${s.patientUid}`}
                    className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-muted/50"
                  >
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.imageUrl} alt="Snapshot" className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{s.patientName}</p>
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
            <Link href="/doctor/appointments" className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {nextAppointments.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No upcoming appointments.</p>
            ) : (
              <div className="space-y-1">
                {nextAppointments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-3 rounded-md p-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{a.patientName}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.label} · {a.date} · {a.time}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1">
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