'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
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

export function AppointmentsTable({
  appointments,
  users,
}: {
  appointments: AdminAppointment[];
  users: AdminUserView[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);

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

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Search by patient, appointment, or doctor..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-sm"
        />
        <AppointmentFormDialog users={users} trigger={<Button>+ New Appointment</Button>} />
      </div>

      <div className="overflow-x-auto rounded-md border">
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
              <TableRow key={`${a.patientUid}-${a.id}`}>
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
                <TableCell className="flex flex-wrap gap-2">
                  <AppointmentFormDialog
                    users={users}
                    editing={a}
                    trigger={
                      <Button variant="outline" size="sm">
                        Edit
                      </Button>
                    }
                  />
                  {a.status === 'upcoming' && (
                    <>
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
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                  No appointments found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}