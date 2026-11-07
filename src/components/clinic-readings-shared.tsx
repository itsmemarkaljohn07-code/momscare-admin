// Read-only pieces shared by the doctor's Health readings card and the
// admin's view: the "Latest values" strip and the patient-reported line.
// The markup is the doctor card's, unchanged.

import { Smartphone } from 'lucide-react';
import { formatDateKey } from '@/lib/pregnancy-display';
import { MEASURES_SHOWN, formatBp, latestClinicValues, latestText, type ClinicReading } from '@/lib/clinic-readings';
import type { PatientReported } from '@/lib/patient-reported';

const shortDate = (day: string) => formatDateKey(day, { month: 'short', day: 'numeric' });

/** Newest value of each measure across the clinic readings. `columns`
 *  lets a narrower card use fewer tiles per row (the doctor card's
 *  full-width default is 2, 3 from 640 px, 6 from 1280 px). */
export function LatestValuesStrip({
  rows, titleId = 'latest-values-title', columns = 'sm:grid-cols-3 xl:grid-cols-6',
}: { rows: ClinicReading[]; titleId?: string; columns?: string }) {
  const latest = latestClinicValues(rows);
  return (
    <section aria-labelledby={titleId} className="space-y-2">
      <h3 id={titleId} className="text-sm font-semibold">Latest values</h3>
      <dl className={`grid grid-cols-2 gap-2 ${columns}`}>
        {MEASURES_SHOWN.map((m) => {
          const value = latestText(m.key, latest);
          return (
            <div key={m.key} className="min-w-0 rounded-xl border bg-muted/30 px-3 py-2">
              <dt className="truncate text-xs text-muted-foreground">{m.label}</dt>
              {value ? (
                <dd>
                  <span className="block truncate text-base font-semibold tabular-nums">{value.text}</span>
                  <span className="text-xs text-muted-foreground">{shortDate(value.date)}</span>
                </dd>
              ) : (
                <dd className="py-1 text-sm text-muted-foreground">Not taken yet</dd>
              )}
            </div>
          );
        })}
      </dl>
    </section>
  );
}

/** The patient's own latest weight and blood pressure, labelled as hers. */
export function PatientReportedLine({ reported }: { reported: PatientReported | null }) {
  const reportedBp = reported ? formatBp(reported) : '';
  const hasReported = reported && (reported.weightKg !== null || reportedBp);
  return (
    <p className="flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
      <Smartphone className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>
        <span className="font-medium text-foreground">Patient-reported (latest):</span>{' '}
        {hasReported ? (
          <>
            {[reported!.weightKg !== null ? `${reported!.weightKg} kg` : '', reportedBp ? `BP ${reportedBp}` : ''].filter(Boolean).join(', ')}
            {reported!.at && <> · logged by the patient with a Snapshot on {new Date(reported!.at).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' })}</>}
          </>
        ) : (
          'nothing logged by the patient yet.'
        )}
      </span>
    </p>
  );
}
