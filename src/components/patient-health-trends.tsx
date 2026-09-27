'use client';

import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import type { AdminSnapshotPhoto } from '@/lib/get-user-snapshots';

const MOOD_NAMES = ['Low', 'Okay', 'Good', 'Great', 'Amazing'];

interface TrendPoint {
  key: string; // unique per point, for the chart's x-axis category
  week: number;
  weight?: number;
  bpSys?: number;
  bpDia?: number;
  kicks?: number;
  mood?: number;
}

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid var(--border)',
  backgroundColor: 'var(--popover)',
  color: 'var(--popover-foreground)',
  fontSize: 12,
  boxShadow: 'var(--shadow-soft)',
};

function MiniTrendChart({
  title,
  data,
  lines,
  yDomain,
  yTickFormatter,
}: {
  title: string;
  data: TrendPoint[];
  lines: { dataKey: string; color: string; name: string }[];
  yDomain?: [number, number];
  yTickFormatter?: (v: number) => string;
}) {
  const hasData = data.some((d) => lines.some((l) => d[l.dataKey as keyof TrendPoint] != null));

  return (
    <Card className="rounded-2xl shadow-soft">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="py-10 text-center text-xs text-muted-foreground">Not enough data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={data} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="week"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                stroke="var(--muted-foreground)"
                tickFormatter={(w) => `Wk ${w}`}
              />
              <YAxis
                fontSize={11}
                tickLine={false}
                axisLine={false}
                stroke="var(--muted-foreground)"
                domain={yDomain}
                tickFormatter={yTickFormatter}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={(w) => `Week ${w}`}
                formatter={(value, name) => [
                  typeof value === 'number' && yTickFormatter ? yTickFormatter(value) : value,
                  name,
                ]}
              />
              {lines.map((l) => (
                <Line
                  key={l.dataKey}
                  type="monotone"
                  dataKey={l.dataKey}
                  name={l.name}
                  stroke={l.color}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function PatientHealthTrends({ photos }: { photos: AdminSnapshotPhoto[] }) {
  const points = useMemo<TrendPoint[]>(() => {
    // photos arrive newest-first; a trend reads left-to-right oldest-first.
    const chronological = [...photos].reverse();
    return chronological
      .filter((p) => p.healthSnapshot)
      .map((p) => ({
        key: p.id,
        week: p.week,
        weight: p.healthSnapshot?.weight,
        bpSys: p.healthSnapshot?.bpSys,
        bpDia: p.healthSnapshot?.bpDia,
        kicks: p.healthSnapshot?.kicks,
        mood: p.healthSnapshot?.mood,
      }));
  }, [photos]);

  if (points.length === 0) {
    return (
      <Card className="rounded-2xl shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" />
            Health Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-6 text-center text-sm text-muted-foreground">
            No health data logged with any photo yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-base font-semibold">Health Trends</h2>
        <span className="text-xs text-muted-foreground">
          {points.length} logged data point{points.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <MiniTrendChart
          title="Weight (kg)"
          data={points}
          lines={[{ dataKey: 'weight', color: 'var(--chart-5)', name: 'Weight' }]}
        />
        <MiniTrendChart
          title="Blood Pressure"
          data={points}
          lines={[
            { dataKey: 'bpSys', color: 'var(--chart-1)', name: 'Systolic' },
            { dataKey: 'bpDia', color: 'var(--chart-4)', name: 'Diastolic' },
          ]}
        />
        <MiniTrendChart
          title="Kicks"
          data={points}
          lines={[{ dataKey: 'kicks', color: 'var(--chart-2)', name: 'Kicks' }]}
        />
        <MiniTrendChart
          title="Mood"
          data={points}
          lines={[{ dataKey: 'mood', color: 'var(--chart-3)', name: 'Mood' }]}
          yDomain={[0, 4]}
          yTickFormatter={(v) => MOOD_NAMES[v] ?? ''}
        />
      </div>
    </div>
  );
}