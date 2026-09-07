import Link from 'next/link';
import { getUsers } from '@/lib/get-users';
import { getInsights } from '@/lib/get-insights';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/page-header';

function toDateSafe(value: any): Date | null {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

export default async function AdminOverviewPage() {
  const [users, articles] = await Promise.all([getUsers(), getInsights()]);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const newThisWeek = users.filter((u) => {
    const created = toDateSafe(u.createdAt);
    return created && created >= sevenDaysAgo;
  }).length;

  const suspendedCount = users.filter((u) => u.disabled).length;

  const recentUsers = [...users]
    .sort((a, b) => {
      const da = toDateSafe(a.createdAt)?.getTime() ?? 0;
      const db = toDateSafe(b.createdAt)?.getTime() ?? 0;
      return db - da;
    })
    .slice(0, 5);

  const recentArticles = [...articles]
    .sort((a, b) => {
      const da = toDateSafe(a.updatedAt)?.getTime() ?? 0;
      const db = toDateSafe(b.updatedAt)?.getTime() ?? 0;
      return db - da;
    })
    .slice(0, 5);

  return (
    <div className="space-y-6">
            <PageHeader title="Overview" description="MomsCare admin dashboard summary" />

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{users.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              New This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{newThisWeek}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Suspended
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{suspendedCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Insights Articles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{articles.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Recent activity ── */}
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
            <CardTitle className="text-base">Recently Updated Articles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentArticles.length === 0 && (
              <p className="text-sm text-muted-foreground">No articles yet.</p>
            )}
            {recentArticles.map((a) => (
              <Link
                key={a.id}
                href={`/admin/insights/${a.id}`}
                className="flex items-center justify-between rounded-md border p-2 text-sm hover:bg-muted/50"
              >
                <p className="font-medium">{a.title}</p>
                <Badge variant="outline">{a.heroTag}</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}