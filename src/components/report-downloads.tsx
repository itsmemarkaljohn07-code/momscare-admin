'use client';

import { useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { manilaKey, rangeForPreset, validRange, type RangePreset } from '@/lib/report-aggregations';

const PRESETS: { value: RangePreset; label: string }[] = [
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'last_30_days', label: 'Last 30 days' },
  { value: 'all_time', label: 'All time' },
];

/** PDF reports: period filter and the download buttons. */
export function ReportDownloads() {
  const today = manilaKey(new Date());
  const [preset, setPreset] = useState<RangePreset | 'custom'>('this_month');
  const [range, setRange] = useState(() => rangeForPreset('this_month', today));
  const [busy, setBusy] = useState<'appointments' | 'patients' | null>(null);
  const [error, setError] = useState('');

  const rangeOk = validRange(range);
  const presetLabel =
    preset === 'custom' ? 'custom dates' : (PRESETS.find((p) => p.value === preset)?.label ?? '').toLowerCase();

  function choosePreset(p: RangePreset) {
    setPreset(p);
    setRange(rangeForPreset(p, today));
    setError('');
  }

  async function downloadAppointments() {
    if (!rangeOk || busy) return;
    setBusy('appointments');
    setError('');
    try {
      const q = new URLSearchParams();
      if (range.from) q.set('from', range.from);
      if (range.to) q.set('to', range.to);
      const res = await fetch(`/api/admin/reports/appointments?${q}`, { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.report) {
        setError(data?.error ?? 'Could not build the report. Please try again.');
        return;
      }
      const { downloadAppointmentReport } = await import('@/lib/appointment-report-pdf');
      await downloadAppointmentReport({ report: data.report, generatedBy: data.generatedBy, presetLabel, maxAppointments: data.maxAppointments });
    } catch {
      setError('Could not build the report. Check your connection and try again.');
    } finally {
      setBusy(null);
    }
  }

  async function downloadPatients() {
    if (busy) return;
    setBusy('patients');
    setError('');
    try {
      const res = await fetch('/api/admin/reports/patients', { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.report) {
        setError(data?.error ?? 'Could not build the report. Please try again.');
        return;
      }
      const { downloadPatientReport } = await import('@/lib/patient-report-pdf');
      await downloadPatientReport({ report: data.report, generatedBy: data.generatedBy });
    } catch {
      setError('Could not build the report. Check your connection and try again.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">PDF reports</CardTitle>
        <CardDescription>Printable summaries for the clinic. They contain patient information; keep them confidential.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium" id="report-period">Appointment report period (Philippine dates)</p>
          <div className="flex flex-wrap gap-2" role="group" aria-labelledby="report-period">
            {PRESETS.map((p) => (
              <Button
                key={p.value}
                type="button"
                size="sm"
                variant={preset === p.value ? 'default' : 'outline'}
                aria-pressed={preset === p.value}
                className="min-h-11 rounded-full md:min-h-8"
                onClick={() => choosePreset(p.value)}
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
                onChange={(e) => { setPreset('custom'); setRange((r) => ({ ...r, from: e.target.value || null })); }}
                className="h-11 w-44 md:h-9"
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              To
              <Input
                type="date"
                value={range.to ?? ''}
                min={range.from ?? undefined}
                onChange={(e) => { setPreset('custom'); setRange((r) => ({ ...r, to: e.target.value || null })); }}
                className="h-11 w-44 md:h-9"
              />
            </label>
            <Button
              type="button"
              className="min-h-11 gap-2 rounded-full md:min-h-9"
              disabled={!rangeOk || busy !== null}
              aria-busy={busy === 'appointments'}
              onClick={downloadAppointments}
            >
              {busy === 'appointments' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileDown className="h-4 w-4" aria-hidden="true" />}
              Download PDF
            </Button>
          </div>
          {!rangeOk && <p className="text-xs text-red-600 dark:text-red-400">The start date must be on or before the end date.</p>}
        </div>

        <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Patient summary</p>
            <p className="text-xs text-muted-foreground">All patients as of today: trimester, assigned doctor, due month and who is due in the next 60 days.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 shrink-0 gap-2 rounded-full md:min-h-9"
            disabled={busy !== null}
            aria-busy={busy === 'patients'}
            onClick={downloadPatients}
          >
            {busy === 'patients' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileDown className="h-4 w-4" aria-hidden="true" />}
            Patient summary (PDF)
          </Button>
        </div>

        <div aria-live="polite">
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
