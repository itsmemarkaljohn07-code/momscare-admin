'use client';

import { useState } from 'react';
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
      if (res.ok) {
        toast.success('Doctor removed.');
        router.refresh();
      } else {
        toast.error('Failed to remove doctor.');
      }
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
          <div className="hidden overflow-x-auto rounded-md border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Specialty</TableHead>
                  <TableHead>Working Days</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Slot Length</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {doctors.map((d) => (
                  <TableRow key={d.id} className="transition-colors hover:bg-muted/50">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${getAvatarStyle(d.id).bg} ${getAvatarStyle(d.id).text}`}>
                          {getInitials(d.name)}
                        </span>
                        {d.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{d.specialty}</span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDays(d.workingDays)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{to12Hour(d.startTime)} – {to12Hour(d.endTime)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{d.slotMinutes} min</TableCell>
                    <TableCell className="flex gap-2">
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
              <Card key={d.id} className="transition-shadow hover:shadow-md">
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-center gap-2">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${getAvatarStyle(d.id).bg} ${getAvatarStyle(d.id).text}`}>
                      {getInitials(d.name)}
                    </span>
                    <div>
                      <p className="font-medium leading-tight">{d.name}</p>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{d.specialty}</span>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <p>{formatDays(d.workingDays)}</p>
                    <p>{to12Hour(d.startTime)} – {to12Hour(d.endTime)} · {d.slotMinutes} min slots</p>
                  </div>
                  <div className="flex gap-2 border-t pt-3">
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
              This removes them from the roster used when creating new appointments. Existing
              appointment records already assigned to them are not affected.
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