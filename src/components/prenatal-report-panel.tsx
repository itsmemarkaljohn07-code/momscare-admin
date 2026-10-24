'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileDown, Loader2, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { manilaKey } from '@/lib/report-aggregations';
import { pdfFileName } from '@/lib/report-layout';
import { formatDateKey } from '@/lib/pregnancy-display';
import { DRAFT_LABEL, NOT_RECORDED, TRIMESTER_NOTE, UNDER_8, type PrenatalReport } from '@/lib/prenatal-report';

type Loaded = { report: PrenatalReport; generatedBy: string };
type Format = 'pdf' | 'csv';

const FORMATS: { value: Format; label: string; hint: string }[] = [
  { value: 'pdf', label: 'PDF', hint: 'Printable report' },
  { value: 'csv', label: 'CSV', hint: "Spreadsheet laid out like the clinic's monthly report" },
];

/** Hands a text file to the browser as a download. */
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

function monthLabel(month: string): string {
  const d = new Date(`${month}-01T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? month : d.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' });
}

/** Monthly Prenatal Services report: preview, data quality and the PDF. */
export function PrenatalReportPanel() {
  const [month, setMonth] = useState(() => manilaKey(new Date()).slice(0, 7));
  const [data, setData] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [format, setFormat] = useState<Format>('pdf');
  const [error, setError] = useState('');

  const valid = /^\d{4}-(0[1-9]|1[0-2])$/.test(month);

  useEffect(() => {
    if (!valid) return;
    let cancelled = false;
    // Loading state for the new month, set before the fetch starts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError('');
    fetch(`/api/admin/reports/prenatal?month=${month}`, { cache: 'no-store' })
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !json?.report) {
          setError(json?.error ?? 'Could not load the report. Please try again.');
          setData(null);
          return;
        }
        setData(json);
      })
      .catch(() => !cancelled && setError('Could not load the report. Check your connection and try again.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [month, valid]);

  async function download() {
    if (!valid || exporting) return;
    setExporting(true);
    setError('');
    try {
      // The export request is the one that is audited (its details are
      // just the format). Both files are built from the same report JSON.
      const res = await fetch(`/api/admin/reports/prenatal?month=${month}&export=1&format=${format}`, { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.report) {
        setError(json?.error ?? 'Could not build the report. Please try again.');
        return;
      }
      if (format === 'csv') {
        const { buildPrenatalCsv } = await import('@/lib/prenatal-report-csv');
        const report: PrenatalReport = json.report;
        const name = pdfFileName(`prenatal-services-${report.month}`, manilaKey(new Date(report.generatedAt))).replace(/.pdf$/, '.csv');
        saveText(buildPrenatalCsv(report), name, 'text/csv;charset=utf-8');
        return;
      }
      const { downloadPrenatalReport } = await import('@/lib/prenatal-report-pdf');
      await downloadPrenatalReport({ report: json.report, generatedBy: json.generatedBy });
    } catch {
      setError('Could not build the report. Check your connection and try again.');
    } finally {
      setExporting(false);
    }
  }

  const r = data?.report;
  const q = r?.dataQuality;
  const notRecordedIdx = r ? r.ageColumns.length - 1 : 0;
  const daysWithVisits = r?.daily.filter((d) => d.total > 0) ?? [];
  const issues = q
    ? [
        q.visitsWithoutDueDate > 0 && `${q.visitsWithoutDueDate} visit${q.visitsWithoutDueDate === 1 ? '' : 's'} by patients without a due date (gestation not recorded).`,
        q.visitsNotApproved > 0 && `${q.visitsNotApproved} completed visit${q.visitsNotApproved === 1 ? ' was' : 's were'} not approved by the doctor (counted).`,
        q.otherAppointments > 0 && `${q.otherAppointments} "Other" appointment${q.otherAppointments === 1 ? '' : 's'} this month (not counted; check whether any were prenatal check-ups).`,
        q.notCompleted.upcoming + q.notCompleted.missed + q.notCompleted.cancelled > 0 &&
          `Not counted: ${q.notCompleted.upcoming} upcoming, ${q.notCompleted.missed} missed, ${q.notCompleted.cancelled} cancelled prenatal appointment(s).`,
      ].filter((x): x is string => !!x)
    : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Prenatal services (monthly)</CardTitle>
        <CardDescription>
          {DRAFT_LABEL}. Completed &quot;Prenatal Checkup&quot; appointments per day and by age group, for the clinic&apos;s monthly report.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Month
            <Input
              type="month"
              value={month}
              max={manilaKey(new Date()).slice(0, 7)}
              onChange={(e) => setMonth(e.target.value)}
              className="h-11 w-48 md:h-9"
            />
          </label>
          <div className="grid gap-1 text-xs font-medium text-muted-foreground">
            <span id="prenatal-format">Format</span>
            <div role="group" aria-labelledby="prenatal-format" className="inline-flex rounded-lg border bg-muted/40 p-1">
              {FORMATS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  aria-pressed={format === f.value}
                  title={f.hint}
                  onClick={() => setFormat(f.value)}
                  className={`min-h-11 min-w-16 rounded-md px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-7 ${
                    format === f.value ? 'bg-primary text-primary-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <Button
            type="button"
            className="min-h-11 gap-2 rounded-full md:min-h-9"
            disabled={!valid || loading || exporting || !r}
            aria-busy={exporting}
            onClick={download}
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileDown className="h-4 w-4" aria-hidden="true" />}
            Download prenatal report ({format === 'csv' ? 'CSV' : 'PDF'})
          </Button>
        </div>
        {r && !loading && r.totals.visits === 0 && (
          <p className="text-sm text-muted-foreground">
            No completed prenatal check-ups in {monthLabel(r.month)}. The file will still download, with zeros and a note.
          </p>
        )}

        <div aria-live="polite">
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
        </div>

        {loading && !r ? (
          <p className="text-sm text-muted-foreground">Loading {monthLabel(month)}…</p>
        ) : r ? (
          <div className={`space-y-4 ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>
            <p className="text-sm font-medium">
              {r.facility.name}, {r.facility.location} · {monthLabel(r.month)}
            </p>

            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['Prenatal check-ups (visits)', r.totals.visits],
                ['Patients seen (unique)', r.totals.uniquePatients],
                ['Visits, age not recorded', r.totals.visitsByAge[notRecordedIdx]],
                ['Visits, due date not recorded', r.dataQuality.visitsWithoutDueDate],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border p-3">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="text-xl font-semibold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <caption className="sr-only">Prenatal check-ups by age group</caption>
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Date</th>
                    {r.ageColumns.map((c) => <th key={c} className="px-3 py-2 text-right font-semibold">{c}</th>)}
                    <th className="px-3 py-2 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {daysWithVisits.length === 0 ? (
                    <tr><td colSpan={r.ageColumns.length + 2} className="px-3 py-4 text-center text-muted-foreground">No completed prenatal check-ups this month.</td></tr>
                  ) : (
                    daysWithVisits.map((d) => (
                      <tr key={d.date} className="border-t">
                        <td className="px-3 py-2">{formatDateKey(d.date, { weekday: 'short', month: 'short', day: 'numeric' })}</td>
                        {d.byAge.map((n, i) => <td key={i} className="px-3 py-2 text-right tabular-nums">{n}</td>)}
                        <td className="px-3 py-2 text-right font-medium tabular-nums">{d.total}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot className="border-t bg-muted/30 font-semibold">
                  <tr>
                    <td className="px-3 py-2">Total visits</td>
                    {r.totals.visitsByAge.map((n, i) => <td key={i} className="px-3 py-2 text-right tabular-nums">{n}</td>)}
                    <td className="px-3 py-2 text-right tabular-nums">{r.totals.visits}</td>
                  </tr>
                  <tr className="border-t font-normal">
                    <td className="px-3 py-2">Unique patients</td>
                    {r.totals.uniqueByAge.map((n, i) => <td key={i} className="px-3 py-2 text-right tabular-nums">{n}</td>)}
                    <td className="px-3 py-2 text-right tabular-nums">{r.totals.uniquePatients}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              Only days with visits are listed here; the PDF lists every day. Age is in full years on the visit date.
            </p>

            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <h3 className="mb-2 text-sm font-semibold">Visits by gestational age</h3>
                <ul className="divide-y rounded-xl border text-sm">
                  {r.gestation.map((g) => (
                    <li key={g.label} className="flex justify-between px-3 py-1.5">
                      <span>{g.label === UNDER_8 ? 'Under 8 weeks' : g.label === NOT_RECORDED ? 'Due date not recorded' : `${g.label} weeks`}</span>
                      <span className="tabular-nums">{g.visits}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">{TRIMESTER_NOTE}</p>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold">Data quality</h3>
                <div className="space-y-2 rounded-xl border p-3 text-sm">
                  {q && q.patientsWithoutDob.length > 0 ? (
                    <div>
                      <p className="flex items-start gap-1.5">
                        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--status-pending)' }} aria-hidden="true" />
                        {q.visitsWithoutDob} visit{q.visitsWithoutDob === 1 ? '' : 's'} by {q.patientsWithoutDob.length} patient{q.patientsWithoutDob.length === 1 ? '' : 's'} without a date of birth (age not recorded). Add it on the patient&apos;s page:
                      </p>
                      <ul className="mt-1 flex flex-wrap gap-x-3 pl-6">
                        {q.patientsWithoutDob.map((p) => (
                          <li key={p.uid}>
                            <Link href={`/admin/users/${p.uid}`} className="inline-flex min-h-11 items-center text-primary hover:underline md:min-h-0">{p.name}</Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">Every patient seen this month has a date of birth.</p>
                  )}
                  {issues.map((text) => (
                    <p key={text} className="flex items-start gap-1.5">
                      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--status-pending)' }} aria-hidden="true" />
                      {text}
                    </p>
                  ))}
                  <p className="border-t pt-2 text-xs text-muted-foreground">
                    Not recorded in MomCare (left blank, never 0): {r.noSourceRows.join('; ')}.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
