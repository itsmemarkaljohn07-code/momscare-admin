'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { UserX } from 'lucide-react';
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

function formatDays(days: number[]): string {
  return [...days].sort((a, b) => a - b).map((d) => DAY_LABELS[d]).join(', ');
}

export function DoctorsTable({ doctors }: { doctors: DoctorRecord[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmDoctor, setConfirmDoctor] = useState<DoctorRecord | null>(null);

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
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Name</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Specialty</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Working Days</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hours</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Slot Length</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Login</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Last Active</TableHead>
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
                    <TableCell className="text-sm text-muted-foreground">{to12Hour(d.startTime)} – {to12Hour(d.endTime)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{d.slotMinutes} min</TableCell>
                    <TableCell>
                      <DoctorLoginDialog doctor={d} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {d.authUid ? formatRelativeTime(d.lastSignInTime) : '—'}
                    </TableCell>
                    <TableCell className="flex flex-wrap gap-2">
                      <Link
                        href={`/admin/doctors/${d.id}`}
                        className="inline-flex items-center text-sm font-medium text-primary hover:underline"
                      >
                        View
                      </Link>
                      <DoctorFormDialog editing={d} trigger={<Button variant="outline" size="sm">Edit</Button>} />
                      <Button variant="ghost" size="sm" disabled={pendingId === d.id} onClick={() => setConfirmDoctor(d)}>
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="grid gap-3 md:hidden">
            {doctors.map((d) => (
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
            ))}
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
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDoctor && handleDelete(confirmDoctor.id)}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}