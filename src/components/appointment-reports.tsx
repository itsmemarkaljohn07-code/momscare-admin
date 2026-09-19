'use client';

import { useMemo, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { StatCard } from '@/components/stat-card';
import {
  CalendarDays, CalendarCheck, CalendarX, Clock, ThumbsUp, ThumbsDown,
} from 'lucide-react';
import type { AdminAppointment } from '@/lib/get-appointments';
import type { DoctorRecord } from '@/lib/get-doctors';

const TYPE_OPTIONS = [
  'Obstetrics', 'OB-GYN', 'Radiology', 'Laboratory',
  'Dietitian', 'Cardiology', 'Pediatrics', 'General Physician', 'Other',
];

const PALETTE = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

type Period = 'yearly' | 'monthly' | 'weekly';

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function getWeekOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 1);
  const oneDay = 24 * 60 * 60 * 1000;
  const dayOfYear = Math.floor((date.getTime() - start.getTime()) / oneDay) + 1;
  return Math.ceil(dayOfYear / 7);
}

export function AppointmentReports({
  appointments,
  doctors,
}: {
  appointments: AdminAppointment[];
  doctors: DoctorRecord[];
}) {
  const [period, setPeriod] = useState<Period>('monthly');
  const [doctorFilter, setDoctorFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [approvalFilter, setApprovalFilter] = useState('all');

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

  const filtered = useMemo(() => {
    return appointments.filter((a) => {
      if (doctorFilter !== 'all' && a.doctor !== doctorFilter) return false;
      if (typeFilter !== 'all' && a.type !== typeFilter) return false;
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (approvalFilter !== 'all' && a.doctorApproval !== approvalFilter) return false;
      return true;
    });
  }, [appointments, doctorFilter, typeFilter, statusFilter, approvalFilter]);

  const periodScoped = useMemo(() => {
    if (period === 'yearly') return filtered;
    return filtered.filter((a) => a.date?.startsWith(String(selectedYear)));
  }, [filtered, period, selectedYear]);

  // Summary counts — always reflect the current filters, independent
  // of the period/year scoping used for the trend chart.
  const summary = useMemo(() => {
    const s = { upcoming: 0, completed: 0, cancelled: 0, pending: 0, approved: 0, rejected: 0 };
    for (const a of filtered) {
      if (a.status === 'upcoming') s.upcoming++;
      if (a.status === 'completed') s.completed++;
      if (a.status === 'cancelled') s.cancelled++;
      if (a.doctorApproval === 'pending') s.pending++;
      if (a.doctorApproval === 'approved') s.approved++;
      if (a.doctorApproval === 'rejected') s.rejected++;
    }
    return s;
  }, [filtered]);

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
    const counts = new Map<number, number>();
    for (const a of periodScoped) {
      const d = new Date(a.date + 'T00:00:00');
      const week = getWeekOfYear(d);
      counts.set(week, (counts.get(week) ?? 0) + 1);
    }
    const maxWeek = Math.max(1, ...Array.from(counts.keys()));
    const result: { label: string; count: number }[] = [];
    for (let w = 1; w <= maxWeek; w++) result.push({ label: `Wk ${w}`, count: counts.get(w) ?? 0 });
    return result;
  }, [period, periodScoped, availableYears]);

  const byDoctor = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of periodScoped) {
      if (a.doctor) counts.set(a.doctor, (counts.get(a.doctor) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([doctor, count]) => ({ doctor, count }))
      .sort((a, b) => b.count - a.count);
  }, [periodScoped]);

  const byType = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of TYPE_OPTIONS) counts.set(t, 0);
    for (const a of periodScoped) {
      if (counts.has(a.type)) counts.set(a.type, (counts.get(a.type) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([type, count]) => ({ type, count }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [periodScoped]);

  const tooltipStyle = {
    borderRadius: 8,
    border: '1px solid var(--border)',
    backgroundColor: 'var(--popover)',
    color: 'var(--popover-foreground)',
    fontSize: 12,
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap gap-2 p-4">
          <Select value={period} onValueChange={(v) => v && setPeriod(v as Period)}>
            <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="yearly">Yearly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
            </SelectContent>
          </Select>
          {period !== 'yearly' && (
            <Select value={String(selectedYear)} onValueChange={(v) => v && setSelectedYear(Number(v))}>
              <SelectTrigger className="w-[90px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {availableYears.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={doctorFilter} onValueChange={(v) => setDoctorFilter(v ?? 'all')}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Doctors</SelectItem>
              {doctors.map((d) => (
                <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v ?? 'all')}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {TYPE_OPTIONS.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? 'all')}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="upcoming">Upcoming</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Select value={approvalFilter} onValueChange={(v) => setApprovalFilter(v ?? 'all')}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Approvals</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Declined</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total (filtered)" value={filtered.length} icon={CalendarDays} color="pink" />
        <StatCard label="Upcoming" value={summary.upcoming} icon={Clock} color="purple" />
        <StatCard label="Completed" value={summary.completed} icon={CalendarCheck} color="mint" />
        <StatCard label="Cancelled" value={summary.cancelled} icon={CalendarX} color="amber" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Pending Approval" value={summary.pending} icon={Clock} color="amber" />
        <StatCard label="Approved" value={summary.approved} icon={ThumbsUp} color="mint" />
        <StatCard label="Declined" value={summary.rejected} icon={ThumbsDown} color="pink" />
      </div>

      {/* Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appointment Trend</CardTitle>
        </CardHeader>
        <CardContent>
          {trendData.every((d) => d.count === 0) ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No data for the selected filters.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={trendData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="reportsTrendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} stroke="var(--muted-foreground)" />
                <YAxis allowDecimals={false} fontSize={11} tickLine={false} axisLine={false} width={28} stroke="var(--muted-foreground)" />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="count" stroke="var(--chart-1)" strokeWidth={2} fill="url(#reportsTrendGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Breakdowns */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Appointments by Doctor</CardTitle>
          </CardHeader>
          <CardContent>
            {byDoctor.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No data available.</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(180, byDoctor.length * 34)}>
                <BarChart data={byDoctor} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                  <XAxis type="number" allowDecimals={false} fontSize={11} tickLine={false} axisLine={false} stroke="var(--muted-foreground)" />
                  <YAxis type="category" dataKey="doctor" fontSize={11} tickLine={false} axisLine={false} width={120} stroke="var(--muted-foreground)" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {byDoctor.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Appointments by Type</CardTitle>
          </CardHeader>
          <CardContent>
            {byType.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No data available.</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(180, byType.length * 34)}>
                <BarChart data={byType} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                  <XAxis type="number" allowDecimals={false} fontSize={11} tickLine={false} axisLine={false} stroke="var(--muted-foreground)" />
                  <YAxis type="category" dataKey="type" fontSize={11} tickLine={false} axisLine={false} width={120} stroke="var(--muted-foreground)" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {byType.map((_, i) => <Cell key={i} fill={PALETTE[(i + 2) % PALETTE.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}