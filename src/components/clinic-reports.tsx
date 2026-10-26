'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, FileDown, FileSpreadsheet, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { manilaKey } from '@/lib/report-aggregations';
import { pdfFileName } from '@/lib/report-layout';
import { DRAFT_LABEL, type PrenatalReport } from '@/lib/prenatal-report';
import { STAYS_RECORDED_FROM, STAYS_SCOPE_NOTE } from '@/lib/stay-report';

type ReportKey = 'monthly' | 'prenatal';
type Loaded = { report: PrenatalReport; generatedBy: string };
type Job = `${ReportKey}-${'pdf' | 'csv'}`;

const FACILITY_TITLE = 'San Joaquin Health Station and Birthing Home, Calbayog City: Monthly Report';

const REPORTS: { key: ReportKey; title: string; description: string }[] = [
  {
    key: 'monthly',
    title: FACILITY_TITLE,
    description: "The clinic's monthly sheet: days across, admissions, deliveries, discharges, transfers and prenatal check-ups, with the signature lines.",
  },
  {
    key: 'prenatal',
    title: 'Prenatal Services Report',
    description: 'The analysis behind the sheet: summary, patients seen by age group, visits by gestational age and data quality.',
  },
];

function monthLabel(month: string): string {
  const d = new Date(`${month}-01T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? month : d.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' });
}

/** Saves a text file through the browser. */
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

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

/** The clinic reports on the Reports page: pick one, set its month, see
 *  its record counts (never names) and download it. Both monthly reports
 *  read the same report JSON from the server. */
export function ClinicReports() {
  const [selected, setSelected] = useState<ReportKey>('monthly');
  const [month, setMonth] = useState(() => manilaKey(new Date()).slice(0, 7));
  const [data, setData] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [job, setJob] = useState<Job | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const valid = /^\d{4}-(0[1-9]|1[0-2])$/.test(month);

  useEffect(() => {
    if (!valid) return;
    let cancelled = false;
    // Loading state for the new month, set before the fetch starts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setLoadError('');
    setResult(null);
    fetch(`/api/admin/reports/prenatal?month=${month}`, { cache: 'no-store' })
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !json?.report) {
          setLoadError(json?.error ?? 'Could not load the report. Please try again.');
          setData(null);
          return;
        }
        setData(json);
      })
      .catch(() => !cancelled && setLoadError('Could not load the report. Check your connection and try again.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [month, valid]);

  async function download(report: ReportKey, format: 'pdf' | 'csv') {
    if (!valid || job) return;
    setJob(`${report}-${format}`);
    setResult(null);
    try {
      // The export request is the one that is audited (report and format only).
      const res = await fetch(`/api/admin/reports/prenatal?month=${month}&export=1&report=${report}&format=${format}`, { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.report) {
        setResult({ ok: false, text: json?.error ?? 'Could not build the report. Please try again.' });
        return;
      }
      const r: PrenatalReport = json.report;
      const pdf = await import('@/lib/prenatal-report-pdf');
      if (report === 'monthly' && format === 'csv') {
        const { buildPrenatalCsv } = await import('@/lib/prenatal-report-csv');
        const name = pdfFileName(`monthly-report-${r.month}`, manilaKey(new Date(r.generatedAt))).replace(/\.pdf$/, '.csv');
        saveText(buildPrenatalCsv(r), name, 'text/csv;charset=utf-8');
      } else if (report === 'monthly') {
        await pdf.downloadMonthlySheet({ report: r });
      } else {
        await pdf.downloadPrenatalReport({ report: r, generatedBy: json.generatedBy });
      }
      setResult({ ok: true, text: `${report === 'monthly' ? 'Monthly Report' : 'Prenatal Services Report'} ${format.toUpperCase()} downloaded.` });
    } catch {
      setResult({ ok: false, text: 'Could not build the report. Check your connection and try again.' });
    } finally {
      setJob(null);
    }
  }

  const r = data?.report;
  const st = r?.stays;
  const q = r?.dataQuality;
  const ageNotRecorded = r ? r.totals.visitsByAge[r.ageColumns.length - 1] : 0;
  const stay = (n: number | undefined) => (st && n !== undefined ? n : 'Not recorded');
  const busy = (k: Job) => job === k;
  const downloadButton = (report: ReportKey, format: 'pdf' | 'csv', label: string) => (
    <Button
      key={`${report}-${format}`}
      type="button"
      variant={format === 'pdf' ? 'default' : 'outline'}
      className="min-h-11 gap-2 rounded-full md:min-h-9"
      disabled={!valid || loading || !r || job !== null}
      aria-busy={busy(`${report}-${format}`)}
      aria-label={label}
      onClick={() => download(report, format)}
    >
      {busy(`${report}-${format}`) ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : format === 'pdf' ? (
        <FileDown className="h-4 w-4" aria-hidden="true" />
      ) : (
        <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
      )}
      Download {format.toUpperCase()}
    </Button>
  );

  return (
    <section aria-labelledby="clinic-reports" className="space-y-4">
      <div>
        <h2 id="clinic-reports" className="text-lg font-semibold">Clinic reports</h2>
        <p className="text-sm text-muted-foreground">{DRAFT_LABEL}. Choose a report, set it up and download it.</p>
      </div>

      <fieldset className="grid gap-3 md:grid-cols-2">
        <legend className="sr-only">Report</legend>
        {REPORTS.map((o) => (
          <label
            key={o.key}
            className={`flex min-h-11 cursor-pointer gap-3 rounded-2xl border p-4 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${
              selected === o.key ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'
            }`}
          >
            <input
              type="radio"
              name="clinic-report"
              value={o.key}
              checked={selected === o.key}
              onChange={() => { setSelected(o.key); setResult(null); }}
              className="mt-1 h-4 w-4 shrink-0 accent-[var(--primary)]"
            />
            <span className="min-w-0">
              <span className="block break-words font-semibold leading-snug">{o.title}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{o.description}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
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
            <p className="pb-2 text-sm text-muted-foreground">{valid ? monthLabel(month) : 'Choose a month'}</p>
          </div>

          <div aria-live="polite">
            {loadError && <p role="alert" className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{loadError}</p>}
          </div>

          {loading && !r ? (
            <p className="text-sm text-muted-foreground">Loading {monthLabel(month)}…</p>
          ) : r ? (
            <div className={`space-y-3 ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>
              <h3 className="text-sm font-semibold">Preview: record counts for {monthLabel(r.month)}</h3>
              {selected === 'monthly' ? (
                <>
                  <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    <Tile label="Prenatal check-ups" value={r.totals.visits} />
                    <Tile label="Admissions (mother + newborn)" value={stay(st?.rows.admissions.total)} />
                    <Tile label="Deliveries" value={stay(st?.rows.deliveries.total)} />
                    <Tile label="Stillbirths" value={stay(st?.rows.stillbirths.total)} />
                    <Tile label="Discharges (mother + baby)" value={stay(st?.rows.discharges.total)} />
                    <Tile label="Transfers to CDH" value={stay(st?.rows.transfers.total)} />
                  </dl>
                  <p className="text-xs text-muted-foreground">
                    {st ? STAYS_SCOPE_NOTE : `Stay rows are "Not recorded" before ${monthLabel(STAYS_RECORDED_FROM)}.`} One A4 landscape page, {r.daily.length} days. The CSV has the same grid plus the summary and data-quality tables.
                  </p>
                </>
              ) : (
                <>
                  <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Tile label="Prenatal check-ups (visits)" value={r.totals.visits} />
                    <Tile label="Patients seen (unique)" value={r.totals.uniquePatients} />
                    <Tile label="Visits, age not recorded" value={ageNotRecorded} />
                    <Tile label="Visits, due date not recorded" value={q?.visitsWithoutDueDate ?? 0} />
                  </dl>
                  <p className="text-xs text-muted-foreground">
                    Data quality: {q?.visitsNotApproved ?? 0} unapproved visit(s) counted, {q?.otherAppointments ?? 0} &quot;Other&quot; appointment(s) not counted, {(q?.notCompleted.upcoming ?? 0) + (q?.notCompleted.missed ?? 0) + (q?.notCompleted.cancelled ?? 0)} prenatal appointment(s) not completed. PDF only; its tables are also in the Monthly Report CSV.
                  </p>
                </>
              )}
              {r.totals.visits === 0 && (
                <p className="text-sm text-muted-foreground">No completed prenatal check-ups in {monthLabel(r.month)}. The files still download, with zeros.</p>
              )}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 border-t pt-4">
            {selected === 'monthly' ? (
              <>
                {downloadButton('monthly', 'pdf', 'Download the Monthly Report as PDF')}
                {downloadButton('monthly', 'csv', 'Download the Monthly Report as CSV')}
              </>
            ) : (
              downloadButton('prenatal', 'pdf', 'Download the Prenatal Services Report as PDF')
            )}
          </div>
          <div aria-live="polite">
            {result && (
              <p
                role={result.ok ? 'status' : 'alert'}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm ${
                  result.ok ? 'bg-muted text-foreground' : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300'
                }`}
              >
                {result.ok && <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: 'var(--status-approved)' }} aria-hidden="true" />}
                {result.text}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
