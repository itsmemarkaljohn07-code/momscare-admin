'use client';

import { useMemo, useState } from 'react';
import { History, Download } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/empty-state';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/status-badge';
import { exportToCsv } from '@/lib/export-csv';
import { isMissedAppointment } from '@/lib/appointment-status';
import type { AdminAppointment } from '@/lib/get-appointments';
import type { DoctorRecord } from '@/lib/get-doctors';

type StatusFilter = 'all' | 'completed' | 'cancelled' | 'missed';

export function AppointmentHistoryTable({
  appointments,
  doctors,
}: {
  appointments: AdminAppointment[]; // pre-filtered to completed/cancelled/missed by the caller
  doctors: DoctorRecord[];
}) {
  const [query, setQuery] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return appointments
      .filter((a) => {
        if (statusFilter === 'all') return true;
        // Missed also covers an overdue appointment whose stored status
        // hasn't been switched to "missed" yet.
        if (statusFilter === 'missed') return isMissedAppointment(a);
        return a.status === statusFilter;
      })
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

  function handleExport() {
    exportToCsv(
      `appointment-history-${new Date().toISOString().slice(0, 10)}`,
      ['Patient', 'Appointment', 'Type', 'Doctor', 'Date', 'Time', 'Status', 'Approval'],
      filtered.map((a) => [
        a.patientName, a.label, a.type, a.doctor, a.date, a.time, a.status, a.doctorApproval,
      ])
    );
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
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-full sm:w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="missed">Missed</SelectItem>
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="col-span-2 gap-1.5 sm:col-span-1"
            onClick={handleExport}
            disabled={filtered.length === 0}
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
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
                      <p className="mt-1 line-clamp-2 max-w-[160px] whitespace-normal break-words text-xs text-muted-foreground" title={a.rejectionReason}>{a.rejectionReason}</p>
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
              <Card key={`${a.patientUid}-${a.id}`} className="rounded-2xl shadow-soft">
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