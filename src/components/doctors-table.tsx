'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { UserX, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/empty-state';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DoctorFormDialog } from '@/components/doctor-form-dialog';
import { getAvatarStyle, getInitials } from '@/lib/avatar-color';
import type { DoctorRecord } from '@/lib/get-doctors';
import type { DoctorStats } from '@/lib/doctor-stats';
import { DoctorLoginDialog } from '@/components/doctor-login-dialog';
import { showApiError } from '@/lib/error-messages';
import { formatRelativeTime } from '@/lib/format-relative-time';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function to12Hour(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${suffix}`;
}

/** Three or more consecutive days collapse to a range ("Mon–Fri");
 *  anything else is listed individually ("Tue, Thu, Sat"). */
function formatDays(days: number[]): string {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  const parts: string[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    if (j - i + 1 >= 3) {
      parts.push(`${DAY_LABELS[sorted[i]]}–${DAY_LABELS[sorted[j]]}`);
    } else {
      for (let k = i; k <= j; k++) parts.push(DAY_LABELS[sorted[k]]);
    }
    i = j + 1;
  }
  return parts.join(', ');
}

function formatHours(d: Pick<DoctorRecord, 'startTime' | 'endTime'>): string {
  return d.startTime && d.endTime ? `${to12Hour(d.startTime)} – ${to12Hour(d.endTime)}` : 'Hours not set';
}

const HEAD_CLASS ='text-xs font-semibold uppercase tracking-wide text-muted-foreground';

function LoadCell({ s }: { s?: DoctorStats }) {
  if (!s) return <span className="text-muted-foreground">—</span>;
  if (s.utilization === null) {
    return <span className="text-xs text-muted-foreground">No schedule</span>;
  }
  const color =
    s.utilization > 100
      ? 'var(--status-declined)'
      : s.utilization >= 70
      ? 'var(--status-pending)'
      : 'var(--status-approved)';
  return (
    <div
      className="w-24 space-y-1"
      title={`${s.bookedThisWeek} booked of ${s.weeklyCapacity} slots in the next 7 days (${s.utilization}%)`}
    >
      <p className="text-sm">{s.bookedThisWeek} / {s.weeklyCapacity}</p>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.min(100, s.utilization)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function PendingCell({ s }: { s?: DoctorStats }) {
  if (!s) return <span className="text-muted-foreground">—</span>;
  if (s.pendingApprovals === 0) return <span className="text-sm text-muted-foreground">0</span>;
  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: 'var(--status-pending-bg)', color: 'var(--status-pending)' }}
      title="Upcoming appointments waiting for this doctor's approval"
    >
      {s.pendingApprovals}
    </span>
  );
}

export function DoctorsTable({
  doctors,
  stats,
}: {
  doctors: DoctorRecord[];
  /** Per-doctor numbers keyed by doctor id. Optional: when missing
   *  (e.g. they failed to load), the new columns show a dash. */
  stats?: Record<string, DoctorStats>;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmDoctor, setConfirmDoctor] = useState<DoctorRecord | null>(null);
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const filtered = q
    ? doctors.filter((d) =>
        [d.name, d.specialty, d.username, d.title].some((v) => (v ?? '').toLowerCase().includes(q))
      )
    : doctors;

  const impact = confirmDoctor ? stats?.[confirmDoctor.id] : undefined;

  async function handleDelete(id: string) {
    setConfirmDoctor(null);
    setPendingId(id);
    try {
      const res = await fetch(`/api/doctors/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        showApiError(res, data, undefined, 'remove doctor');
        return;
      }
      toast.success('Doctor removed.');
      router.refresh();
    } catch (err) {
      showApiError(null, null, err, 'remove doctor');
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {doctors.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            aria-label="Search doctors"
            placeholder="Search by name, specialty or username..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="rounded-full pl-10"
          />
        </div>
      )}

      {doctors.length === 0 ? (
        <EmptyState icon={UserX} title="No doctors yet" description="Add your first doctor to start scheduling appointments." />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="No matching doctors" description={`Nothing matches "${query.trim()}".`} />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-2xl border shadow-soft md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className={HEAD_CLASS}>Name</TableHead>
                  <TableHead className={HEAD_CLASS}>Specialty</TableHead>
                  <TableHead className={HEAD_CLASS}>Working Days</TableHead>
                  <TableHead className={HEAD_CLASS}>Hours</TableHead>
                  <TableHead className={HEAD_CLASS} title="Patients who have been booked with this doctor">Patients</TableHead>
                  <TableHead className={HEAD_CLASS} title="Booked slots vs. capacity over the next 7 days">This Week</TableHead>
                  <TableHead className={HEAD_CLASS} title="Upcoming appointments waiting for this doctor's approval">Pending</TableHead>
                  <TableHead className={HEAD_CLASS}>Login</TableHead>
                  <TableHead className={HEAD_CLASS}>Last Active</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((d) => (
                  <TableRow key={d.id} className="transition-colors hover:bg-muted/50">
                    <TableCell className="font-medium">
                      <div className="flex w-56 min-w-0 items-center gap-2 lg:w-64" title={d.name}>
                        {d.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={d.photoUrl}
                            alt={d.name}
                            className="h-7 w-7 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${getAvatarStyle(d.id).bg} ${getAvatarStyle(d.id).text}`}>
                            {getInitials(d.name)}
                          </span>
                        )}
                        <span className="truncate">{d.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="whitespace-nowrap rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                        {d.specialty || 'Not set'}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatDays(d.workingDays) || 'Not set'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <p className="whitespace-nowrap">{formatHours(d)}</p>
                      <p className="whitespace-nowrap text-xs">{d.slotMinutes ? `${d.slotMinutes}-min slots` : 'Slot length not set'}</p>
                    </TableCell>
                    <TableCell className="text-sm">
                      {stats?.[d.id] ? stats[d.id].patients : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <LoadCell s={stats?.[d.id]} />
                    </TableCell>
                    <TableCell>
                      <PendingCell s={stats?.[d.id]} />
                    </TableCell>
                    <TableCell>
                      <DoctorLoginDialog doctor={d} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {d.authUid ? formatRelativeTime(d.lastSignInTime) : '—'}
                    </TableCell>
                    <TableCell>
                      {/* One row that never wraps (the table scrolls
                          sideways instead); every action is always visible
                          and reachable with the keyboard. */}
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          nativeButton={false}
                          render={<Link href={`/admin/doctors/${d.id}`} aria-label={`View ${d.name}`} />}
                        >
                          View
                        </Button>
                        <DoctorFormDialog
                          editing={d}
                          trigger={<Button variant="outline" size="sm" aria-label={`Edit ${d.name}`}>Edit</Button>}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/30"
                          disabled={pendingId === d.id}
                          onClick={() => setConfirmDoctor(d)}
                          aria-label={`Remove ${d.name}`}
                        >
                          Remove
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="grid gap-3 md:hidden">
            {filtered.map((d) => {
              const s = stats?.[d.id];
              return (
                <Card key={d.id} className="rounded-2xl shadow-soft transition-shadow hover:shadow-card">
                  <CardContent className="space-y-3 p-4">
                    <div className="flex min-w-0 items-center gap-2">
                      {d.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={d.photoUrl}
                          alt={d.name}
                          className="h-9 w-9 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${getAvatarStyle(d.id).bg} ${getAvatarStyle(d.id).text}`}>
                          {getInitials(d.name)}
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-medium leading-tight">{d.name}</p>
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{d.specialty}</span>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <p className="truncate">{formatDays(d.workingDays) || 'Working days not set'}</p>
                      <p className="truncate">
                        {formatHours(d)}
                        {d.slotMinutes ? ` · ${d.slotMinutes} min slots` : ''}
                      </p>
                      {s && (
                        <p className="truncate">
                          {s.patients} patient{s.patients === 1 ? '' : 's'}
                          {s.utilization !== null && ` · ${s.bookedThisWeek}/${s.weeklyCapacity} slots this week`}
                          {s.pendingApprovals > 0 && ` · ${s.pendingApprovals} pending`}
                        </p>
                      )}
                      {d.authUid && <p>Last active: {formatRelativeTime(d.lastSignInTime)}</p>}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        nativeButton={false}
                        render={<Link href={`/admin/doctors/${d.id}`} aria-label={`View ${d.name}`} />}
                      >
                        View
                      </Button>
                      <DoctorFormDialog
                        editing={d}
                        trigger={<Button variant="outline" size="sm" aria-label={`Edit ${d.name}`}>Edit</Button>}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-auto text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/30"
                        disabled={pendingId === d.id}
                        onClick={() => setConfirmDoctor(d)}
                        aria-label={`Remove ${d.name}`}
                      >
                        Remove
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      <AlertDialog open={!!confirmDoctor} onOpenChange={(open) => !open && setConfirmDoctor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {confirmDoctor?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes them from the roster and permanently deletes their login account, so
              they can no longer sign in. This cannot be undone. Appointment records already
              assigned to them are kept as they are.
            </AlertDialogDescription>
            {impact && (impact.upcomingAppointments > 0 || impact.patients > 0) && (
              <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                They currently have {impact.upcomingAppointments} upcoming appointment
                {impact.upcomingAppointments === 1 ? '' : 's'}
                {impact.pendingApprovals > 0 && ` (${impact.pendingApprovals} awaiting approval)`} and{' '}
                {impact.patients} assigned patient{impact.patients === 1 ? '' : 's'}. These stay in
                the system, but no doctor account will be able to act on them.
              </p>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive-solid" onClick={() => confirmDoctor && handleDelete(confirmDoctor.id)}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}