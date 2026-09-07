import { notFound } from 'next/navigation';
import { getUserById } from '@/lib/get-users';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

function computeWeek(dueDate: string | null): number | null {
  if (!dueDate) return null;
  const TOTAL_DAYS = 280;
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysUntilDue = Math.round((new Date(dueDate).getTime() - Date.now()) / msPerDay);
  const daysElapsed = Math.max(0, Math.min(TOTAL_DAYS, TOTAL_DAYS - daysUntilDue));
  return Math.min(40, Math.floor(daysElapsed / 7));
}

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ uid: string }>;
}) {
  const { uid } = await params;
  const user = await getUserById(uid);

  if (!user) {
    notFound();
  }

  const week = computeWeek(user.dueDate);

  return (
    <div className="max-w-xl space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{user.fullName}</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <Badge variant={user.disabled ? 'destructive' : 'secondary'}>
          {user.disabled ? 'Suspended' : 'Active'}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between border-b pb-2">
            <span className="text-muted-foreground">Due Date</span>
            <span>{user.dueDate ?? '—'}</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-muted-foreground">Current Week</span>
            <span>{week !== null ? `Week ${week}` : '—'}</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-muted-foreground">First-time Mom</span>
            <span>{user.firstTimeMom === null ? '—' : user.firstTimeMom ? 'Yes' : 'No'}</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-muted-foreground">Clinic</span>
            <span>{user.clinicName || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Signed Up</span>
            <span>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}</span>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Health, mood, and checklist data are not shown here — this view is limited to
        account and profile information only.
      </p>
    </div>
  );
}