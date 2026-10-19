'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { manilaKey, rangeForPreset, validRange, type DateRange, type RangePreset } from '@/lib/report-aggregations';

const PRESETS: { value: RangePreset; label: string }[] = [
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'last_30_days', label: 'Last 30 days' },
  { value: 'all_time', label: 'All time' },
];

/** Period state for a report download: preset or custom Philippine dates. */
export function useReportPeriod(initial: RangePreset = 'this_month') {
  const today = manilaKey(new Date());
  const [preset, setPreset] = useState<RangePreset | 'custom'>(initial);
  const [range, setRange] = useState<DateRange>(() => rangeForPreset(initial, today));
  const presetLabel =
    preset === 'custom' ? 'custom dates' : (PRESETS.find((p) => p.value === preset)?.label ?? '').toLowerCase();
  const query = new URLSearchParams();
  if (range.from) query.set('from', range.from);
  if (range.to) query.set('to', range.to);
  return {
    preset,
    range,
    presetLabel,
    rangeOk: validRange(range),
    query: query.toString(),
    choosePreset(p: RangePreset) {
      setPreset(p);
      setRange(rangeForPreset(p, today));
    },
    setFrom(from: string | null) {
      setPreset('custom');
      setRange((r) => ({ ...r, from }));
    },
    setTo(to: string | null) {
      setPreset('custom');
      setRange((r) => ({ ...r, to }));
    },
  };
}

/** Preset chips and From/To date inputs for a report period. */
export function ReportPeriodFields({ period, labelId, label }: { period: ReturnType<typeof useReportPeriod>; labelId: string; label: string }) {
  const { preset, range } = period;
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium" id={labelId}>{label}</p>
      <div className="flex flex-wrap gap-2" role="group" aria-labelledby={labelId}>
        {PRESETS.map((p) => (
          <Button
            key={p.value}
            type="button"
            size="sm"
            variant={preset === p.value ? 'default' : 'outline'}
            aria-pressed={preset === p.value}
            className="min-h-11 rounded-full md:min-h-8"
            onClick={() => period.choosePreset(p.value)}
          >
            {p.label}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          From
          <Input
            type="date"
            value={range.from ?? ''}
            max={range.to ?? undefined}
            onChange={(e) => period.setFrom(e.target.value || null)}
            className="h-11 w-40 md:h-9"
          />
        </label>
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          To
          <Input
            type="date"
            value={range.to ?? ''}
            min={range.from ?? undefined}
            onChange={(e) => period.setTo(e.target.value || null)}
            className="h-11 w-40 md:h-9"
          />
        </label>
      </div>
      {!period.rangeOk && <p className="text-xs text-red-600 dark:text-red-400">The start date must be on or before the end date.</p>}
    </div>
  );
}
