'use client';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function AppointmentsChart({ data }: { data: { date: string; count: number }[] }) {
  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={formatted} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="apptGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#e07eb8" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#e07eb8" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
        <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis allowDecimals={false} fontSize={11} tickLine={false} axisLine={false} width={28} />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: '1px solid #eee', fontSize: 12 }}
          labelStyle={{ fontWeight: 600 }}
        />
        <Area type="monotone" dataKey="count" stroke="#e07eb8" strokeWidth={2} fill="url(#apptGradient)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}