'use client';

import { useState } from 'react';
import { List, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import { DoctorAppointmentsTable } from '@/components/doctor-appointments-table';
import { DoctorAppointmentsCalendar } from '@/components/doctor-appointments-calendar';
import { DoctorLiveNotice, useDoctorLiveAppointments } from '@/components/doctor-live-appointments';
import { useMarkMissed } from '@/hooks/use-mark-missed';

type View = 'list' | 'calendar';

/** My Appointments: the doctor layout's live list (see
 *  DoctorLiveAppointmentsProvider), as a table or a calendar. */
export function DoctorAppointmentsLive() {
  const list = useDoctorLiveAppointments()?.appointments ?? [];
  // 3 hours after their start, appointments are stored as missed and the
  // patient is notified; the badges re-check every minute.
  useMarkMissed(list);
  const [view, setView] = useState<View>('list');

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Appointments"
        description={`${list.length} appointment${list.length === 1 ? '' : 's'} booked with you. Approve or decline pending ones.`}
      />
      <div className="space-y-4">
        <DoctorLiveNotice />
        <div className="inline-flex rounded-lg border bg-muted/40 p-1" role="group" aria-label="View">
          <Button
            type="button"
            variant={view === 'list' ? 'default' : 'ghost'}
            size="sm"
            className="min-h-11 gap-1.5 sm:min-h-8"
            aria-pressed={view === 'list'}
            onClick={() => setView('list')}
          >
            <List className="h-3.5 w-3.5" />
            List
          </Button>
          <Button
            type="button"
            variant={view === 'calendar' ? 'default' : 'ghost'}
            size="sm"
            className="min-h-11 gap-1.5 sm:min-h-8"
            aria-pressed={view === 'calendar'}
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
    </div>
  );
}
