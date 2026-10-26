'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, FileDown, FileSpreadsheet, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { manilaKey } from '@/lib/report-aggregations';
import { pdfFileName } from '@/lib/report-layout';
import { INCLUSION_RULE, LIST_SCOPE_NOTE, type PregnantList } from '@/lib/pregnant-list';

type Counts = PregnantList['counts'];

function saveText(text: string, fileName: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

/** The List of Pregnant Women: report date and barangay, a counts-only
 *  preview (no names or addresses on screen), PDF and CSV. */
export function PregnantListPanel() {
  const today = manilaKey(new Date());
  const [date, setDate] = useState(today);
  const [barangay, setBarangay] = useState('');
  const [barangays, setBarangays] = useState<string[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [job, setJob] = useState<'pdf' | 'csv' | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const query = `date=${date}${barangay ? `&barangay=${encodeURIComponent(barangay)}` : ''}`;

  useEffect(() => {
    if (!valid) return;
    let cancelled = false;
    // Loading state for the new filter, set before the fetch starts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setLoadError('');
    setResult(null);
    fetch(`/api/admin/reports/pregnant-list?${query}`, { cache: 'no-store' })
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !json?.counts) {
          setLoadError(json?.error ?? 'Could not load the list. Please try again.');
          setCounts(null);
          return;
        }
        setCounts(json.counts);
        setBarangays(json.barangays ?? []);
      })
      .catch(() => !cancelled && setLoadError('Could not load the list. Check your connection and try again.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [query, valid]);

  async function download(format: 'pdf' | 'csv') {
    if (!valid || job) return;
    setJob(format);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/reports/pregnant-list?${query}&export=1&format=${format}`, { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.list) {
        setResult({ ok: false, text: json?.error ?? 'Could not build the list. Please try again.' });
        return;
      }
      const list: PregnantList = json.list;
      if (format === 'csv') {
        const { buildPregnantListCsv } = await import('@/lib/pregnant-list-csv');
        const name = pdfFileName(`list-of-pregnant-women-${list.reportDate}`, manilaKey(new Date(json.generatedAt))).replace(/\.pdf$/, '.csv');
        saveText(buildPregnantListCsv(list), name, 'text/csv;charset=utf-8');
      } else {
        const { downloadPregnantList } = await import('@/lib/pregnant-list-pdf');
        downloadPregnantList({ list, generatedAt: json.generatedAt });
      }
      setResult({ ok: true, text: `List of Pregnant Women ${format.toUpperCase()} downloaded (${list.rows.length} listed).` });
    } catch {
      setResult({ ok: false, text: 'Could not build the list. Check your connection and try again.' });
    } finally {
      setJob(null);
    }
  }

  const button = (format: 'pdf' | 'csv') => (
    <Button
      key={format}
      type="button"
      variant={format === 'pdf' ? 'default' : 'outline'}
      className="min-h-11 gap-2 rounded-full md:min-h-9"
      disabled={!valid || loading || !counts || job !== null}
      aria-busy={job === format}
      aria-label={`Download the List of Pregnant Women as ${format.toUpperCase()}`}
      onClick={() => download(format)}
    >
      {job === format ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : format === 'pdf' ? <FileDown className="h-4 w-4" aria-hidden="true" /> : <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />}
      Download {format.toUpperCase()}
    </Button>
  );

  return (
    <Card>
      <CardContent className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Report date
            <Input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} className="h-11 w-48 md:h-9" />
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Barangay
            <select
              value={barangay}
              onChange={(e) => setBarangay(e.target.value)}
              className="h-11 w-56 max-w-full rounded-md border bg-background px-3 text-sm text-foreground md:h-9"
            >
              <option value="">All barangays</option>
              {barangays.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </label>
        </div>

        <p className="text-xs text-muted-foreground">{INCLUSION_RULE} {LIST_SCOPE_NOTE}</p>

        <div aria-live="polite">
          {loadError && <p role="alert" className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{loadError}</p>}
        </div>

        {loading && !counts ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : counts ? (
          <div className={`space-y-3 ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>
            <h3 className="text-sm font-semibold">Preview: record counts</h3>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Tile label="Listed (pregnant on this date)" value={counts.listed} />
              <Tile label="No due date, not listed" value={counts.noDueDate} />
              <Tile label="Delivered on or before this date" value={counts.delivered} />
              <Tile label="Outside the pregnancy window" value={counts.outsideWindow} />
            </dl>
            {counts.listed === 0 && <p className="text-sm text-muted-foreground">No pregnant women match this date{barangay ? ' and barangay' : ''}. The files still download, with a message.</p>}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 border-t pt-4">
          {button('pdf')}
          {button('csv')}
        </div>
        <div aria-live="polite">
          {result && (
            <p
              role={result.ok ? 'status' : 'alert'}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm ${result.ok ? 'bg-muted text-foreground' : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300'}`}
            >
              {result.ok && <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: 'var(--status-approved)' }} aria-hidden="true" />}
              {result.text}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
