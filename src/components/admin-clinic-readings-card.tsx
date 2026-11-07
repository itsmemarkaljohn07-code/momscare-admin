'use client';

import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LatestValuesStrip, PatientReportedLine } from '@/components/clinic-readings-shared';
import { formatDateKey } from '@/lib/pregnancy-display';
import { MEASURES_SHOWN, measureText, type ClinicReading } from '@/lib/clinic-readings';
import { clinicTrendCharts, type ClinicChart } from '@/lib/patient-detail-report';
import type { PatientReported } from '@/lib/patient-reported';

type Row = ClinicReading & { id: string };

const FIRST = 10;
const longDate = (day: string) => formatDateKey(day, { month: 'short', day: 'numeric', year: 'numeric' });
const shortDate = (day: string) => formatDateKey(day, { month: 'short', day: 'numeric' });

/** The dashboard's chart colours, one per chart (blood pressure uses two). */
const COLORS: Record<string, string[]> = {
  Weight: ['var(--chart-5)'],
  'Blood pressure': ['var(--chart-1)', 'var(--chart-4)'],
  'Fundal height': ['var(--chart-2)'],
  'Fetal heart rate': ['var(--chart-3)'],
  Pulse: ['var(--chart-1)'],
  Temperature: ['var(--chart-4)'],
};
const UNIT: Record<string, string> = { kg: 'kg', mmHg: 'mmHg', cm: 'cm', bpm: 'bpm', C: '°C' };

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid var(--border)',
  backgroundColor: 'var(--popover)',
  color: 'var(--popover-foreground)',
  fontSize: 12,
  boxShadow: 'var(--shadow-soft)',
};

/** One small line chart of clinic points, oldest first, dates on the x axis. */
function TrendChart({ chart }: { chart: ClinicChart }) {
  const title = `${chart.title} (${UNIT[chart.unit] ?? chart.unit})`;
  const data = chart.days.map((day, i) => ({ i, day, ...Object.fromEntries(chart.series.map((s, n) => [`s${n}`, s.values[i]])) }));
  const colors = COLORS[chart.title] ?? ['var(--chart-1)', 'var(--chart-2)'];
  return (
    <figure data-chart-title={chart.title} className="min-w-0 rounded-xl border p-3">
      <figcaption className="mb-2 text-sm font-medium">{title}</figcaption>
      <ResponsiveContainer width="100%" height={170}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="i"
            type="number"
            domain={[0, Math.max(1, data.length - 1)]}
            ticks={data.length <= 6 ? data.map((d) => d.i) : [0, Math.floor((data.length - 1) / 2), data.length - 1]}
            tickFormatter={(i: number) => (data[i] ? shortDate(data[i].day) : '')}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            stroke="var(--muted-foreground)"
          />
          <YAxis fontSize={11} tickLine={false} axisLine={false} stroke="var(--muted-foreground)" domain={['auto', 'auto']} width={40} />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(i) => (data[Number(i)] ? longDate(data[Number(i)].day) : '')}
          />
          {chart.series.map((s, n) => (
            <Line
              key={s.label}
              type="monotone"
              dataKey={`s${n}`}
              name={chart.series.length > 1 ? s.label : chart.title}
              stroke={colors[n] ?? colors[0]}
              strokeWidth={2}
              dot={{ r: 3 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      {chart.series.length > 1 && (
        <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
          {chart.series.map((s, n) => (
            <span key={s.label} className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2 w-3 rounded-sm" style={{ backgroundColor: colors[n] }} aria-hidden="true" />
              {s.label}
            </span>
          ))}
        </p>
      )}
    </figure>
  );
}

/** Clinic readings for an admin: view only. Recorded by the assigned
 *  doctor on the doctor page; nothing here adds, edits or deletes. */
export function AdminClinicReadingsCard({ rows, reported }: { rows: Row[] | null; reported: PatientReported | null }) {
  const [showAll, setShowAll] = useState(false);
  const charts = useMemo(() => (rows ? clinicTrendCharts(rows) : []), [rows]);
  const shown = rows ? (showAll ? rows : rows.slice(0, FIRST)) : [];

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle id="admin-readings-title" className="text-base">Health readings</CardTitle>
        <CardDescription>Measured at the clinic by the assigned doctor. View only.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {rows === null ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">Could not load the clinic readings. Reload the page to try again.</p>
        ) : (
          // This card sits in the narrower left column: 2 tiles a row, 3 from
          // 1280 px (6 would cut "120/80 mmHg" short).
          <LatestValuesStrip rows={rows} titleId="admin-latest-values-title" columns="xl:grid-cols-3" />
        )}

        <PatientReportedLine reported={reported} />

        {rows !== null && rows.length > 0 && (
          <section aria-labelledby="admin-trends-title" className="space-y-3 border-t pt-4">
            <h3 id="admin-trends-title" className="text-sm font-semibold">Trends</h3>
            {charts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Not enough clinic readings for a chart.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {charts.map((c) => <TrendChart key={c.title} chart={c} />)}
              </div>
            )}
          </section>
        )}

        {rows !== null && (
          <section aria-labelledby="admin-readings-list-title" className="space-y-2 border-t pt-4">
            <h3 id="admin-readings-list-title" className="text-sm font-semibold">Clinic readings</h3>
            {rows.length === 0 ? (
              <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No clinic readings yet. The assigned doctor records them at checkups.</p>
            ) : (
              <>
                <ul className="space-y-2">
                  {shown.map((r) => {
                    const taken = MEASURES_SHOWN.map((m) => ({ m, v: measureText(m.key, r) })).filter((x) => x.v !== null);
                    return (
                      <li key={r.id} data-reading className="rounded-xl border p-3 text-sm sm:p-4">
                        <h4 className="font-semibold">{longDate(r.measuredOn)}</h4>
                        <p className="text-xs text-muted-foreground">Entered by {r.enteredByName || 'a doctor'}</p>
                        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                          {taken.map(({ m, v }) => (
                            <div key={m.key} className="min-w-0">
                              <dt className="text-xs text-muted-foreground">{m.label}</dt>
                              <dd className="font-medium tabular-nums">{v}</dd>
                            </div>
                          ))}
                        </dl>
                        {r.note && <p className="mt-2 break-words border-t pt-2 text-sm text-muted-foreground">{r.note}</p>}
                      </li>
                    );
                  })}
                </ul>
                {rows.length > FIRST && (
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 w-full sm:w-auto"
                    aria-expanded={showAll}
                    aria-controls="admin-readings-list-title"
                    onClick={() => setShowAll((v) => !v)}
                  >
                    {showAll ? `Show the newest ${FIRST}` : `Show all ${rows.length} readings`}
                  </Button>
                )}
              </>
            )}
          </section>
        )}
      </CardContent>
    </Card>
  );
}
