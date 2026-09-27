import Link from 'next/link';
import { getUsers } from '@/lib/get-users';
import { getDoctors } from '@/lib/get-doctors';
import { getAdmins } from '@/lib/get-admins';
import { getInsights } from '@/lib/get-insights';
import { getAppointmentStats } from '@/lib/get-appointment-stats';
import { getAdminSession } from '@/lib/get-admin-session';
import { getPatientRiskIndicators } from '@/lib/get-patient-risk-indicators';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { AppointmentAnalytics } from '@/components/appointment-analytics';
import { PatientRiskPanel } from '@/components/patient-risk-panel';
import { getAvatarStyle, getInitials } from '@/lib/avatar-color';
import {
  Users as UsersIcon, Stethoscope, ShieldCheck, LayoutGrid,
  CalendarCheck, Newspaper, UserX,
} from 'lucide-react';

function toDateSafe(value: string | { toDate: () => Date } | null | undefined): Date | null {
  if (!value) return null;
  if (typeof value === 'object' && typeof value.toDate === 'function') return value.toDate();
  const d = new Date(value as string);
  return isNaN(d.getTime()) ? null : d;
}

export default async function AdminOverviewPage() {
  const [users, doctors, admins, articles, { appointments, stats }, session, riskFlags] = await Promise.all([
    getUsers(),
    getDoctors(),
    getAdmins(),
    getInsights(),
    getAppointmentStats(),
    getAdminSession(),
    getPatientRiskIndicators(),
  ]);

  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const newThisWeek = users.filter((u) => {
    const created = toDateSafe(u.createdAt);
    return created && created >= sevenDaysAgo;
  }).length;
  const newLastWeek = users.filter((u) => {
    const created = toDateSafe(u.createdAt);
    return created && created >= fourteenDaysAgo && created < sevenDaysAgo;
  }).length;
  const userTrend =
    newLastWeek > 0
      ? Math.round(((newThisWeek - newLastWeek) / newLastWeek) * 100)
      : newThisWeek > 0
      ? 100
      : 0;

  const suspendedCount = users.filter((u) => u.disabled).length;
  const totalAccounts = users.length + doctors.length + admins.length;

  const recentUsers = [...users]
    .sort(
      (a, b) => (toDateSafe(b.createdAt)?.getTime() ?? 0) - (toDateSafe(a.createdAt)?.getTime() ?? 0)
    )
    .slice(0, 5);

  const firstName = session?.email?.split('@')[0];

  // ── Doctor Workload: booked appointments THIS WEEK vs. each
  // doctor's actual weekly capacity (working days × slots/day) —
  // more useful than a raw all-time count, since it accounts for how
  // much time a doctor actually has available.
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const weekFromNowStr = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const upcomingThisWeekByDoctor = new Map<string, number>();
  for (const a of appointments) {
    if (a.status === 'upcoming' && a.date >= todayStr && a.date <= weekFromNowStr) {
      upcomingThisWeekByDoctor.set(a.doctor, (upcomingThisWeekByDoctor.get(a.doctor) ?? 0) + 1);
    }
  }

  function weeklyCapacity(d: (typeof doctors)[number]): number {
    if (!d.startTime || !d.endTime || !d.slotMinutes || d.workingDays.length === 0) return 0;
    const [startH, startM] = d.startTime.split(':').map(Number);
    const [endH, endM] = d.endTime.split(':').map(Number);
    const totalMinutes = endH * 60 + endM - (startH * 60 + startM);
    if (totalMinutes <= 0) return 0;
    return Math.floor(totalMinutes / d.slotMinutes) * d.workingDays.length;
  }

  const workload = doctors
    .map((d) => {
      const capacity = weeklyCapacity(d);
      const booked = upcomingThisWeekByDoctor.get(d.name) ?? 0;
      const utilization = capacity > 0 ? Math.round((booked / capacity) * 100) : null;
      return { name: d.name, booked, capacity, utilization };
    })
    .sort((a, b) => (b.utilization ?? -1) - (a.utilization ?? -1));

  return (
    <div className="space-y-6">
      <PageHeader
        title={firstName ? `Welcome back, ${firstName}` : 'Overview'}
        description="Here's what's happening across MomsCare today"
      />

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
          Accounts
        </p>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Total Accounts" value={totalAccounts} icon={LayoutGrid} color="pink" />
          <StatCard
            label="Patients"
            value={users.length}
            icon={UsersIcon}
            color="purple"
            trend={{ value: userTrend, positive: userTrend >= 0 }}
          />
          <StatCard label="Doctors" value={doctors.length} icon={Stethoscope} color="mint" />
          <StatCard label="Admins" value={admins.length} icon={ShieldCheck} color="amber" />
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
          Activity
        </p>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Upcoming Appointments"
            value={stats.upcoming}
            icon={CalendarCheck}
            color="purple"
          />
          <StatCard label="Insights Articles" value={articles.length} icon={Newspaper} color="mint" />
          <StatCard label="Suspended Patients" value={suspendedCount} icon={UserX} color="amber" />
        </div>
      </div>

      <PatientRiskPanel flags={riskFlags} />

      <AppointmentAnalytics appointments={appointments} />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Signups</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentUsers.length === 0 && (
              <p className="text-sm text-muted-foreground">No users yet.</p>
            )}
            {recentUsers.map((u) => (
              <Link
                key={u.uid}
                href={`/admin/users/${u.uid}`}
                className="flex items-center gap-3 rounded-lg p-2 text-sm transition-colors hover:bg-muted/50"
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${getAvatarStyle(u.uid).bg} ${getAvatarStyle(u.uid).text}`}
                >
                  {getInitials(u.fullName)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{u.fullName}</p>
                  <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                </div>
                <Badge variant={u.disabled ? 'destructive' : 'secondary'}>
                  {u.disabled ? 'Suspended' : 'Active'}
                </Badge>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Doctor Workload</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {workload.length === 0 && (
              <p className="text-sm text-muted-foreground">No doctors yet.</p>
            )}
            {workload.map((w) => {
              const color =
                w.utilization === null
                  ? 'var(--muted-foreground)'
                  : w.utilization > 100
                  ? 'var(--status-declined)'
                  : w.utilization >= 70
                  ? 'var(--status-pending)'
                  : 'var(--status-approved)';
              return (
                <div key={w.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{w.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {w.utilization === null
                        ? 'No schedule set'
                        : `${w.booked} / ${w.capacity} slots this week (${w.utilization}%)`}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: w.utilization === null ? '0%' : `${Math.min(100, w.utilization)}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}