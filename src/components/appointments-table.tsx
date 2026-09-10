'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CalendarX, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import type { AdminAppointment } from '@/lib/get-appointments';
import type { AdminUserView } from '@/lib/get-users';

const ACCENT_STYLES: Record<string, { bg: string; text: string }> = {
  green:  { bg: 'bg-[#e0f5ea]', text: 'text-[#3ba876]' },
  pink:   { bg: 'bg-[#fce8f3]', text: 'text-[#d9609a]' },
  purple: { bg: 'bg-[#f0e6fb]', text: 'text-[#9b6fc4]' },
  blue:   { bg: 'bg-[#e3edfb]', text: 'text-[#4f7fc2]' },
  orange: { bg: 'bg-[#fdf1e0]', text: 'text-[#d99a3a]' },
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
  upcoming: 'default',
  completed: 'secondary',
  cancelled: 'destructive',
};

import type { DoctorRecord } from '@/lib/get-doctors';

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
      if (res.ok) {
        toast.success(`Appointment marked as ${status}.`);
        router.refresh();
      } else {
        toast.error('Failed to update appointment.');
      }
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
      if (res.ok) {
        toast.success('Appointment deleted successfully.');
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to delete appointment.');
      }
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
          className="max-w-sm"
        />
         <AppointmentFormDialog users={users} appointments={appointments} doctors={doctors} trigger={<Button>+ New Appointment</Button>} />
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
          <div className="hidden overflow-x-auto rounded-md border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Appointment</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((a) => (
                  <TableRow key={`${a.patientUid}-${a.id}`} className="transition-colors hover:bg-muted/50">
                    <TableCell className="font-medium">{a.patientName}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm ${ACCENT_STYLES[a.accentColor]?.bg ?? 'bg-muted'}`}
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
                      <Badge variant={STATUS_VARIANT[a.status] ?? 'default'}>{a.status}</Badge>
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
                          <div className="max-w-0 overflow-hidden opacity-0 transition-all duration-200 ease-out group-hover:max-w-[90px] group-hover:opacity-100">
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
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile stacked cards */}
          <div className="grid gap-3 md:hidden">
            {filtered.map((a) => (
              <Card key={`${a.patientUid}-${a.id}`} className="transition-shadow hover:shadow-md">
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base ${ACCENT_STYLES[a.accentColor]?.bg ?? 'bg-muted'}`}
                      >
                        {a.icon}
                      </span>
                      <div>
                        <p className="font-medium leading-tight">{a.label}</p>
                        <p className="text-xs text-muted-foreground">{a.patientName}</p>
                      </div>
                    </div>
                    <Badge variant={STATUS_VARIANT[a.status] ?? 'default'}>{a.status}</Badge>
                  </div>

                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{a.doctor}</span>
                    <span>{a.date} · {a.time}</span>
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
                      <div className="max-w-0 overflow-hidden opacity-0 transition-all duration-200 ease-out group-hover:max-w-[90px] group-hover:opacity-100">
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
            ))}
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