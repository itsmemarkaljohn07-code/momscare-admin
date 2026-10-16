'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { UserX, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

const HEAD_CLASS = 'text-xs font-semibold uppercase tracking-wide text-muted-foreground';

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
      {doctors.length === 0 ? (
        <EmptyState icon={UserX} title="No doctors yet" description="Add your first doctor to start scheduling appointments." />
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
                {doctors.map((d) => (
                  <TableRow key={d.id} className="transition-colors hover:bg-muted/50">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
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
                        {d.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{d.specialty}</span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDays(d.workingDays)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <p className="whitespace-nowrap">{to12Hour(d.startTime)} – {to12Hour(d.endTime)}</p>
                      <p className="text-xs">{d.slotMinutes}-min slots</p>
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
                      {/* Same layout as the Patients table: one row that
                          never wraps (the table scrolls instead), and the
                          destructive action only appears on hovering the
                          chevron. */}
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/doctors/${d.id}`}
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          View
                        </Link>
                        <DoctorFormDialog editing={d} trigger={<Button variant="outline" size="sm">Edit</Button>} />
                        <div className="group/expand flex items-center gap-1">
                          <ChevronRight className="h-4 w-4 shrink-0 cursor-default text-muted-foreground transition-transform duration-200 group-hover/expand:translate-x-0.5" />
                          <div className="max-w-0 overflow-hidden opacity-0 transition-all duration-300 ease-out group-hover/expand:max-w-[90px] group-hover/expand:opacity-100">
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              disabled={pendingId === d.id}
                              onClick={() => setConfirmDoctor(d)}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="grid gap-3 md:hidden">
            {doctors.map((d) => {
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
                      <p className="truncate">{formatDays(d.workingDays)}</p>
                      <p className="truncate">{to12Hour(d.startTime)} – {to12Hour(d.endTime)} · {d.slotMinutes} min slots</p>
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
                      <Link
                        href={`/admin/doctors/${d.id}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        View
                      </Link>
                      <DoctorFormDialog editing={d} trigger={<Button variant="outline" size="sm">Edit</Button>} />
                      <Button variant="ghost" size="sm" disabled={pendingId === d.id} onClick={() => setConfirmDoctor(d)}>
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