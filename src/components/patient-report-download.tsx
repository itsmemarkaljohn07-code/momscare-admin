'use client';

import { useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ReportPeriodFields, useReportPeriod } from '@/components/report-period';

/** "Download patient report (PDF)" for one patient, admin or assigned doctor. */
export function PatientReportDownload({ patientUid }: { patientUid: string }) {
  const period = useReportPeriod('all_time');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function download() {
    if (!period.rangeOk || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/reports/patient/${encodeURIComponent(patientUid)}?${period.query}`, { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.report) {
        setError(data?.error ?? 'Could not build the report. Please try again.');
        return;
      }
      const { downloadPatientDetailReport } = await import('@/lib/patient-detail-pdf');
      await downloadPatientDetailReport({
        report: data.report,
        generatedBy: data.generatedBy,
        generatorRole: data.generatorRole,
        presetLabel: period.presetLabel,
      });
    } catch {
      setError('Could not build the report. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Patient report</CardTitle>
        <CardDescription>Profile, appointments, health readings and Snapshots for the period. No photos or clinical notes. Keep it confidential.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ReportPeriodFields period={period} labelId={`patient-report-period-${patientUid}`} label="Period (Philippine dates)" />
        <Button
          type="button"
          className="min-h-11 gap-2 rounded-full md:min-h-9"
          disabled={!period.rangeOk || busy}
          aria-busy={busy}
          onClick={download}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileDown className="h-4 w-4" aria-hidden="true" />}
          Download patient report (PDF)
        </Button>
        <div aria-live="polite">
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
