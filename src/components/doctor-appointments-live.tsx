'use client';

import { useState } from 'react';
import type { DocumentData } from 'firebase/firestore';
import { List, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DoctorAppointmentsTable } from '@/components/doctor-appointments-table';
import { DoctorAppointmentsCalendar } from '@/components/doctor-appointments-calendar';
import { useLiveAppointments } from '@/hooks/use-live-appointments';
import { useMarkMissed } from '@/hooks/use-mark-missed';
import { mapCancellation } from '@/lib/appointment-cancellation';
import type { DoctorAppointmentView } from '@/lib/get-doctor-appointments';

type View = 'list' | 'calendar';

function toDoctorView(base: DoctorAppointmentView, data: DocumentData): DoctorAppointmentView {
  return {
    id: base.id,
    patientUid: base.patientUid,
    patientName: base.patientName,
    label: data.label,
    type: data.type,
    date: data.date,
    time: data.time,
    location: data.location,
    notes: data.notes,
    status: data.status,
    doctorApproval: data.doctorApproval ?? 'pending',
    rejectionReason: data.rejectionReason,
    cancellation: mapCancellation(data.cancellation),
  };
}

export function DoctorAppointmentsLive({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  doctorName,
  initial,
}: {
  doctorName: string;
  initial: DoctorAppointmentView[];
}) {
  // No client-side discovery query: `initial` comes from the server
  // (Admin SDK, already filtered to this doctor) and each known document
  // gets its own listener. See useLiveAppointments.
  const list = useLiveAppointments(initial, toDoctorView);
  // 3 hours after their start, appointments are stored as missed and the
  // patient is notified; the badges re-check every minute.
  useMarkMissed(list);
  const [view, setView] = useState<View>('list');

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border bg-muted/40 p-1">
        <Button
          type="button"
          variant={view === 'list' ? 'default' : 'ghost'}
          size="sm"
          className="gap-1.5"
          onClick={() => setView('list')}
        >
          <List className="h-3.5 w-3.5" />
          List
        </Button>
        <Button
          type="button"
          variant={view === 'calendar' ? 'default' : 'ghost'}
          size="sm"
          className="gap-1.5"
          onClick={() => setView('calendar')}
        >
          <CalendarDays className="h-3.5 w-3.5" />
          Calendar
        </Button>
      </div>

      {view === 'list' ? (
        <DoctorAppointmentsTable appointments={list} />
      ) : (
        <DoctorAppointmentsCalendar appointments={list} />
      )}
    </div>
  );
}