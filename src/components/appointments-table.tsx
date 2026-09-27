'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CalendarX, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
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
import { AppointmentFormDialog } from '@/components/appointment-form-dialog';
import { StatusBadge } from '@/components/status-badge';
import { showApiError } from '@/lib/error-messages';
import { computeDisplayStatus } from '@/lib/appointment-status';
import type { AdminAppointment } from '@/lib/get-appointments';
import type { AdminUserView } from '@/lib/get-users';
import type { DoctorRecord } from '@/lib/get-doctors';

// Dark-mode-safe accent chip colors, sourced from globals.css tokens
// instead of hardcoded light-only hex classes.
const ACCENT_BG_VAR: Record<string, string> = {
  green: 'var(--accent-green-bg)',
  pink: 'var(--accent-pink-bg)',
  purple: 'var(--accent-purple-bg)',
  blue: 'var(--accent-blue-bg)',
  orange: 'var(--accent-orange-bg)',
};

export function AppointmentsTable({
  appointments,
  users,
  doctors,
}: {
  appointments: AdminAppointment[];
  users: AdminUserView[];
  doctors: DoctorRecord[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminAppointment | null>(null);

  const filtered = appointments.filter((a) => {
    const q = query.toLowerCase();
    return (
      a.patientName.toLowerCase().includes(q) ||
      a.label.toLowerCase().includes(q) ||
      a.doctor.toLowerCase().includes(q)
    );
  });

  async function setStatus(appt: AdminAppointment, status: string) {
    setPendingId(appt.id);
    try {
      const res = await fetch(`/api/appointments/${appt.patientUid}/${appt.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        showApiError(res, data, undefined, 'update appointment status');
        return;
      }
      toast.success(`Appointment marked as ${status}.`);
      router.refresh();
    } catch (err) {
      showApiError(null, null, err, 'update appointment status');
    } finally {
      setPendingId(null);
    }
  }

  async function handleDelete(appt: AdminAppointment) {
    setConfirmDelete(null);
    setPendingId(appt.id);
    try {
      const res = await fetch(`/api/appointments/${appt.patientUid}/${appt.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        showApiError(res, data, undefined, 'delete appointment');
        return;
      }
      toast.success('Appointment deleted successfully.');
      router.refresh();
    } catch (err) {
      showApiError(null, null, err, 'delete appointment');
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Search by patient, appointment, or doctor..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-sm rounded-full"
        />
        <AppointmentFormDialog users={users} appointments={appointments} doctors={doctors} trigger={<Button className="rounded-full">+ New Appointment</Button>} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={CalendarX}
          title="No appointments found"
          description={query ? 'Try a different search term.' : 'No appointments have been scheduled yet.'}
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-2xl border shadow-soft md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Patient</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Appointment</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Doctor</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Time</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Approval</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((a) => {
                  const displayStatus = computeDisplayStatus(a.date, a.time, a.status);
                  const approval = a.doctorApproval ?? 'pending';
                  const rejectionReason = a.rejectionReason;
                  return (
                    <TableRow key={`${a.patientUid}-${a.id}`} className="transition-colors hover:bg-muted/50">
                      <TableCell className="font-medium">{a.patientName}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm"
                            style={{ backgroundColor: ACCENT_BG_VAR[a.accentColor] ?? 'var(--muted)' }}
                          >
                            {a.icon}
                          </span>
                          {a.label}
                        </div>
                      </TableCell>
                      <TableCell>{a.doctor}</TableCell>
                      <TableCell>{a.date}</TableCell>
                      <TableCell>{a.time}</TableCell>
                      <TableCell>
                        <StatusBadge status={displayStatus} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={approval} />
                        {approval === 'rejected' && rejectionReason && (
                          <p
                            className="mt-1 line-clamp-2 max-w-[200px] whitespace-normal break-words text-xs text-muted-foreground"
                            title={rejectionReason}
                          >
                            {rejectionReason}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        {a.status === 'upcoming' ? (
                          <div className="flex flex-wrap gap-2">
                            <AppointmentFormDialog
                              users={users}
                              appointments={appointments}
                              doctors={doctors}
                              editing={a}
                              trigger={<Button variant="outline" size="sm">Edit</Button>}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={pendingId === a.id}
                              onClick={() => setStatus(a, 'completed')}
                            >
                              Complete
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={pendingId === a.id}
                              onClick={() => setStatus(a, 'cancelled')}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <div className="group flex items-center gap-1">
                            <AppointmentFormDialog
                              users={users}
                              appointments={appointments}
                              doctors={doctors}
                              editing={a}
                              trigger={<Button variant="outline" size="sm">Edit</Button>}
                            />
                            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5" />
                            <div className="max-w-0 overflow-hidden opacity-0 transition-all duration-500 ease-out group-hover:max-w-[90px] group-hover:opacity-100">
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled={pendingId === a.id}
                                onClick={() => setConfirmDelete(a)}
                              >
                                Delete
                              </Button>
                            </div>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile stacked cards */}
          <div className="grid gap-3 md:hidden">
            {filtered.map((a) => {
              const displayStatus = computeDisplayStatus(a.date, a.time, a.status);
              const approval = a.doctorApproval ?? 'pending';
              const rejectionReason = a.rejectionReason;
              return (
                <Card key={`${a.patientUid}-${a.id}`} className="rounded-2xl shadow-soft transition-shadow hover:shadow-card">
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base"
                          style={{ backgroundColor: ACCENT_BG_VAR[a.accentColor] ?? 'var(--muted)' }}
                        >
                          {a.icon}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium leading-tight">{a.label}</p>
                          <p className="truncate text-xs text-muted-foreground">{a.patientName}</p>
                        </div>
                      </div>
                      <StatusBadge status={displayStatus} />
                    </div>

                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span className="min-w-0 truncate">{a.doctor}</span>
                      <span className="shrink-0">{a.date} · {a.time}</span>
                    </div>

                    <div>
                      <StatusBadge status={approval} />
                      {approval === 'rejected' && rejectionReason && (
                        <p
                          className="mt-1 line-clamp-2 whitespace-normal break-words text-xs text-muted-foreground"
                          title={rejectionReason}
                        >
                          {rejectionReason}
                        </p>
                      )}
                    </div>

                    {a.status === 'upcoming' ? (
                      <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                        <AppointmentFormDialog
                          users={users}
                          appointments={appointments}
                          doctors={doctors}
                          editing={a}
                          trigger={<Button variant="outline" size="sm">Edit</Button>}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={pendingId === a.id}
                          onClick={() => setStatus(a, 'completed')}
                        >
                          Complete
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={pendingId === a.id}
                          onClick={() => setStatus(a, 'cancelled')}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="group flex items-center gap-1 border-t pt-3">
                        <AppointmentFormDialog
                          users={users}
                          appointments={appointments}
                          doctors={doctors}
                          editing={a}
                          trigger={<Button variant="outline" size="sm">Edit</Button>}
                        />
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5" />
                        <div className="max-w-0 overflow-hidden opacity-0 transition-all duration-500 ease-out group-hover:max-w-[90px] group-hover:opacity-100">
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={pendingId === a.id}
                            onClick={() => setConfirmDelete(a)}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      <AlertDialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Appointment?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete this {confirmDelete?.status} appointment
              for {confirmDelete?.patientName}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDelete && handleDelete(confirmDelete)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}