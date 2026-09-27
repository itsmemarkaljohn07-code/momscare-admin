'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/status-badge';
import type { DoctorAppointmentView } from '@/lib/get-doctor-appointments';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfWeek(d: Date): Date {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - date.getDay());
  return date;
}

export function DoctorAppointmentsCalendar({ appointments }: { appointments: DoctorAppointmentView[] }) {
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    }),
    [weekStart]
  );

  const byDate = useMemo(() => {
    const map = new Map<string, DoctorAppointmentView[]>();
    for (const a of appointments) {
      if (!map.has(a.date)) map.set(a.date, []);
      map.get(a.date)!.push(a);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.time.localeCompare(b.time));
    }
    return map;
  }, [appointments]);

  const todayKey = toDateKey(new Date());
  const rangeLabel = `${weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  function goPrevWeek() {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  }
  function goNextWeek() {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  }
  function goThisWeek() {
    setWeekStart(startOfWeek(new Date()));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" onClick={goPrevWeek} aria-label="Previous week">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon-sm" onClick={goNextWeek} aria-label="Next week">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={goThisWeek}>Today</Button>
        </div>
        <p className="text-sm font-medium text-muted-foreground">{rangeLabel}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-7">
        {weekDays.map((d) => {
          const key = toDateKey(d);
          const dayAppts = byDate.get(key) ?? [];
          const isToday = key === todayKey;
          return (
            <div
              key={key}
              className={`rounded-lg border p-2 ${isToday ? 'border-primary bg-primary/5' : ''}`}
            >
              <div className="mb-2 flex items-center justify-between sm:flex-col sm:items-start sm:gap-0.5">
                <p className={`text-xs font-semibold uppercase tracking-wide ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                  {DAY_LABELS[d.getDay()]}
                </p>
                <p className={`text-sm font-bold ${isToday ? 'text-primary' : ''}`}>{d.getDate()}</p>
              </div>
              <div className="space-y-1.5">
                {dayAppts.length === 0 ? (
                  <p className="py-2 text-center text-[11px] text-muted-foreground">No appointments</p>
                ) : (
                  dayAppts.map((a) => (
                    <div key={a.id} className="rounded-md border bg-card p-1.5 text-xs">
                      <p className="font-medium leading-tight">{a.time}</p>
                      <p className="truncate leading-tight">{a.patientName}</p>
                      <p className="truncate text-[10px] leading-tight text-muted-foreground">{a.label}</p>
                      <div className="mt-1">
                        <StatusBadge status={a.doctorApproval} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}