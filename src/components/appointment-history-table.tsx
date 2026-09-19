'use client';

import { useMemo, useState } from 'react';
import { History } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/empty-state';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/status-badge';
import type { AdminAppointment } from '@/lib/get-appointments';
import type { DoctorRecord } from '@/lib/get-doctors';

type StatusFilter = 'all' | 'completed' | 'cancelled';

export function AppointmentHistoryTable({
  appointments,
  doctors,
}: {
  appointments: AdminAppointment[]; // pre-filtered to completed/cancelled by the caller
  doctors: DoctorRecord[];
}) {
  const [query, setQuery] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return appointments
      .filter((a) => statusFilter === 'all' || a.status === statusFilter)
      .filter((a) => doctorFilter === 'all' || a.doctor === doctorFilter)
      .filter(
        (a) =>
          !q ||
          a.patientName.toLowerCase().includes(q) ||
          a.label.toLowerCase().includes(q) ||
          a.doctor.toLowerCase().includes(q)
      )
      // Most recent first — history is for looking back.
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [appointments, query, doctorFilter, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Search by patient, appointment, or doctor..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-sm"
        />
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-full sm:w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Select value={doctorFilter} onValueChange={(v) => setDoctorFilter(v ?? 'all')}>
            <SelectTrigger className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Doctors</SelectItem>
              {doctors.map((d) => (
                <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={History}
          title="No history found"
          description={query || doctorFilter !== 'all' || statusFilter !== 'all'
            ? 'Try different filters.'
            : 'Completed and cancelled appointments will appear here.'}
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
                  <TableHead>Approval</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((a) => (
                  <TableRow key={`${a.patientUid}-${a.id}`} className="transition-colors hover:bg-muted/50">
                    <TableCell className="font-medium">{a.patientName}</TableCell>
                    <TableCell>
                      {a.label} <span className="text-xs text-muted-foreground">({a.type})</span>
                    </TableCell>
                    <TableCell>{a.doctor}</TableCell>
                    <TableCell>{a.date}</TableCell>
                    <TableCell>{a.time}</TableCell>
                    <TableCell><StatusBadge status={a.status} /></TableCell>
                    <TableCell>
                      <StatusBadge status={a.doctorApproval} />
                      {a.doctorApproval === 'rejected' && a.rejectionReason && (
                        <p className="mt-1 max-w-[160px] text-xs text-muted-foreground">{a.rejectionReason}</p>
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
              <Card key={`${a.patientUid}-${a.id}`}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium leading-tight">{a.label}</p>
                      <p className="truncate text-xs text-muted-foreground">{a.patientName}</p>
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="min-w-0 truncate">{a.doctor}</span>
                    <span className="shrink-0">{a.date} · {a.time}</span>
                  </div>
                  <StatusBadge status={a.doctorApproval} />
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}