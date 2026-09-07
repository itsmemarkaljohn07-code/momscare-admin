import Link from 'next/link';
import { getUsers } from '@/lib/get-users';
import { getInsights } from '@/lib/get-insights';
import { getAppointmentStats } from '@/lib/get-appointment-stats';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { AppointmentsChart } from '@/components/appointments-chart';
import { Users as UsersIcon, CalendarCheck, Newspaper, UserX } from 'lucide-react';

function toDateSafe(value: any): Date | null {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

export default async function AdminOverviewPage() {
  const [users, articles, { stats }] = await Promise.all([
    getUsers(),
    getInsights(),
    getAppointmentStats(),
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

  const recentUsers = [...users]
    .sort(
      (a, b) => (toDateSafe(b.createdAt)?.getTime() ?? 0) - (toDateSafe(a.createdAt)?.getTime() ?? 0)
    )
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeader title="Overview" description="MomsCare admin dashboard summary" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Users"
          value={users.length}
          icon={UsersIcon}
          color="pink"
          trend={{ value: userTrend, positive: userTrend >= 0 }}
        />
        <StatCard
          label="Upcoming Appointments"
          value={stats.upcoming}
          icon={CalendarCheck}
          color="purple"
        />
        <StatCard label="Insights Articles" value={articles.length} icon={Newspaper} color="mint" />
        <StatCard label="Suspended Accounts" value={suspendedCount} icon={UserX} color="amber" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Appointments — Last 14 Days</CardTitle>
          </CardHeader>
          <CardContent>
            <AppointmentsChart data={stats.trend} />
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span>
                <strong>{stats.total}</strong> total
              </span>
              <span className="text-muted-foreground">·</span>
              <span>
                <strong>{stats.upcoming}</strong> upcoming
              </span>
              <span className="text-muted-foreground">·</span>
              <span>
                <strong>{stats.completed}</strong> completed
              </span>
              <span className="text-muted-foreground">·</span>
              <span>
                <strong>{stats.cancelled}</strong> cancelled
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Appointment Types</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.byType.length === 0 && (
              <p className="text-sm text-muted-foreground">No appointments yet.</p>
            )}
            {stats.byType.map((t) => (
              <div key={t.type} className="flex items-center justify-between text-sm">
                <span>{t.type}</span>
                <Badge variant="secondary">{t.count}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Signups</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentUsers.length === 0 && (
              <p className="text-sm text-muted-foreground">No users yet.</p>
            )}
            {recentUsers.map((u) => (
              <Link
                key={u.uid}
                href={`/admin/users/${u.uid}`}
                className="flex items-center justify-between rounded-md border p-2 text-sm hover:bg-muted/50"
              >
                <div>
                  <p className="font-medium">{u.fullName}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
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
            <CardTitle className="text-base">Busiest Doctors</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.byDoctor.length === 0 && (
              <p className="text-sm text-muted-foreground">No appointments yet.</p>
            )}
            {stats.byDoctor.map((d) => (
              <div key={d.doctor} className="flex items-center justify-between text-sm">
                <span>{d.doctor}</span>
                <Badge variant="secondary">{d.count} appts</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}