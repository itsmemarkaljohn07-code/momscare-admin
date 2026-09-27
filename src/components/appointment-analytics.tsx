'use client';

import { useMemo, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { AdminAppointment } from '@/lib/get-appointments';

// Kept in sync with the same lists in appointment-form-dialog.tsx —
// duplicated here deliberately (rather than importing from that file)
// to keep this read-only analytics view decoupled from the
// appointment creation form's own state and logic.
const TYPE_OPTIONS = [
  'Obstetrics', 'OB-GYN', 'Radiology', 'Laboratory',
  'Dietitian', 'Cardiology', 'Pediatrics', 'General Physician', 'Other',
];
const NAME_OPTIONS = [
  'Prenatal Checkup', 'Booking Appointment', 'Nuchal Scan', 'Anomaly Scan',
  'Glucose Tolerance Test', 'Group B Strep Test', 'Ultrasound', 'Blood Test',
  'Postpartum Checkup', 'Other',
];

// The 5 theme-aware chart tokens from globals.css, cycled for bar
// breakdowns of arbitrary length — replaces the old 10-color
// hardcoded hex PALETTE, which didn't adapt to dark mode.
const PALETTE = [
  'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)',
];

type Period = 'yearly' | 'monthly' | 'weekly';

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function getWeekOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 1);
  const oneDay = 24 * 60 * 60 * 1000;
  const dayOfYear = Math.floor((date.getTime() - start.getTime()) / oneDay) + 1;
  return Math.ceil(dayOfYear / 7);
}

export function AppointmentAnalytics({ appointments }: { appointments: AdminAppointment[] }) {
  const [period, setPeriod] = useState<Period>('yearly');
  const [typeFilter, setTypeFilter] = useState('all');
  const [nameFilter, setNameFilter] = useState('all');

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    for (const a of appointments) {
      const y = parseInt(a.date?.slice(0, 4), 10);
      if (!isNaN(y)) years.add(y);
    }
    if (years.size === 0) years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [appointments]);

  const [selectedYear, setSelectedYear] = useState<number>(availableYears[0]);

  // Matches "if both filters are selected, show only matching
  // appointments" — used for the trend chart and the Total count.
  const fullyFiltered = useMemo(() => {
    return appointments.filter((a) => {
      if (typeFilter !== 'all' && a.type !== typeFilter) return false;
      if (nameFilter !== 'all' && a.label !== nameFilter) return false;
      return true;
    });
  }, [appointments, typeFilter, nameFilter]);

  // Monthly/Weekly views are additionally scoped to the selected
  // year. Yearly view intentionally spans every year in the data.
  const periodScoped = useMemo(() => {
    if (period === 'yearly') return fullyFiltered;
    return fullyFiltered.filter((a) => a.date?.startsWith(String(selectedYear)));
  }, [fullyFiltered, period, selectedYear]);

  const totalCount = periodScoped.length;

  const trendData = useMemo(() => {
    if (period === 'yearly') {
      const counts = new Map<number, number>();
      for (const y of availableYears) counts.set(y, 0);
      for (const a of periodScoped) {
        const y = parseInt(a.date?.slice(0, 4), 10);
        if (!isNaN(y)) counts.set(y, (counts.get(y) ?? 0) + 1);
      }
      return Array.from(counts.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([year, count]) => ({ label: String(year), count }));
    }

    if (period === 'monthly') {
      const counts = new Array(12).fill(0);
      for (const a of periodScoped) {
        const m = parseInt(a.date?.slice(5, 7), 10) - 1;
        if (m >= 0 && m < 12) counts[m]++;
      }
      return MONTH_LABELS.map((label, i) => ({ label, count: counts[i] }));
    }

    // weekly — simple calendar-week bucketing (not strict ISO weeks),
    // grouped within the selected year.
    const counts = new Map<number, number>();
    for (const a of periodScoped) {
      const d = new Date(a.date + 'T00:00:00');
      const week = getWeekOfYear(d);
      counts.set(week, (counts.get(week) ?? 0) + 1);
    }
    const maxWeek = Math.max(1, ...Array.from(counts.keys()));
    const result: { label: string; count: number }[] = [];
    for (let w = 1; w <= maxWeek; w++) {
      result.push({ label: `Wk ${w}`, count: counts.get(w) ?? 0 });
    }
    return result;
  }, [period, periodScoped, availableYears]);

  // Respects the Name filter + period/year scope, but ignores its OWN
  // Type filter — see the note above this component.
  const typeBreakdown = useMemo(() => {
    const source = appointments.filter((a) => {
      if (nameFilter !== 'all' && a.label !== nameFilter) return false;
      if (period !== 'yearly' && !a.date?.startsWith(String(selectedYear))) return false;
      return true;
    });
    const counts = new Map<string, number>();
    for (const t of TYPE_OPTIONS) counts.set(t, 0);
    for (const a of source) {
      if (counts.has(a.type)) counts.set(a.type, (counts.get(a.type) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([type, count]) => ({ type, count }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [appointments, nameFilter, period, selectedYear]);

  // Mirrors the above, for Names.
  const nameBreakdown = useMemo(() => {
    const source = appointments.filter((a) => {
      if (typeFilter !== 'all' && a.type !== typeFilter) return false;
      if (period !== 'yearly' && !a.date?.startsWith(String(selectedYear))) return false;
      return true;
    });
    const counts = new Map<string, number>();
    for (const n of NAME_OPTIONS) counts.set(n, 0);
    for (const a of source) {
      if (counts.has(a.label)) counts.set(a.label, (counts.get(a.label) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [appointments, typeFilter, period, selectedYear]);

  const tooltipStyle = {
    borderRadius: 12,
    border: '1px solid var(--border)',
    backgroundColor: 'var(--popover)',
    color: 'var(--popover-foreground)',
    fontSize: 12,
    boxShadow: 'var(--shadow-soft)',
  };

  return (
    <Card className="rounded-2xl shadow-soft">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">Appointment Analytics</CardTitle>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Select value={period} onValueChange={(v) => v && setPeriod(v as Period)}>
              <SelectTrigger className="w-full sm:w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="yearly">Yearly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
              </SelectContent>
            </Select>

            {period !== 'yearly' && (
              <Select value={String(selectedYear)} onValueChange={(v) => v && setSelectedYear(Number(v))}>
                <SelectTrigger className="w-full sm:w-[90px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {availableYears.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v ?? 'all')}>
              <SelectTrigger className="w-full sm:w-[170px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Appointment Types</SelectItem>
                {TYPE_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={nameFilter} onValueChange={(v) => setNameFilter(v ?? 'all')}>
              <SelectTrigger className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Appointment Names</SelectItem>
                {NAME_OPTIONS.map((n) => (
                  <SelectItem key={n} value={n}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Total Appointments</p>
          <p className="text-3xl font-bold">{totalCount}</p>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Appointment Booking Trend</p>
          {trendData.every((d) => d.count === 0) ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No appointment data for the selected filters.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={trendData} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="analyticsTrendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} stroke="var(--muted-foreground)" />
                <YAxis allowDecimals={false} fontSize={11} tickLine={false} axisLine={false} stroke="var(--muted-foreground)" />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="count" stroke="var(--chart-1)" strokeWidth={2} fill="url(#analyticsTrendGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-medium">Most Booked Appointment Types</p>
            {typeBreakdown.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No data available.</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(180, typeBreakdown.length * 34)}>
                <BarChart data={typeBreakdown} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                  <XAxis type="number" allowDecimals={false} fontSize={11} tickLine={false} axisLine={false} stroke="var(--muted-foreground)" />
                  <YAxis type="category" dataKey="type" fontSize={11} tickLine={false} axisLine={false} stroke="var(--muted-foreground)" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {typeBreakdown.map((_, i) => (
                      <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Most Booked Appointment Names</p>
            {nameBreakdown.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No data available.</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(180, nameBreakdown.length * 34)}>
                <BarChart data={nameBreakdown} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                  <XAxis type="number" allowDecimals={false} fontSize={11} tickLine={false} axisLine={false} stroke="var(--muted-foreground)" />
                  <YAxis type="category" dataKey="name" fontSize={11} tickLine={false} axisLine={false} stroke="var(--muted-foreground)" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {nameBreakdown.map((_, i) => (
                      <Cell key={i} fill={PALETTE[(i + 2) % PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}