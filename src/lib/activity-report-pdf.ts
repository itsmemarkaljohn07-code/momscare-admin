// Lays out the admin activity summary (data from
// /api/admin/reports/activity) with the shared PDF template. Client-side.
// No free-text details.

import { ReportPdf } from '@/lib/report-pdf';
import { formatDayKey, formatMonthKey, manilaDateKey, manilaDateTime, pdfFileName, periodLabel } from '@/lib/report-layout';
import { LATEST_ENTRIES, type ActivityReport } from '@/lib/activity-report';

export async function downloadActivityReport(input: {
  report: ActivityReport;
  generatedBy: string;
  presetLabel: string;
  maxEntries: number;
}): Promise<void> {
  const { report, generatedBy, presetLabel, maxEntries } = input;
  const now = new Date(report.generatedAt);
  const pdf = await ReportPdf.create({
    title: 'Activity Summary',
    period: periodLabel(report.range.from, report.range.to),
    generatedBy,
    generatedAt: now,
    filters: [`Period: ${presetLabel}`, 'Source: audit log'],
  });

  if (report.capped) {
    pdf.note(`This summary covers the newest ${maxEntries.toLocaleString('en-US')} entries in the period only. Choose a shorter period for complete numbers.`);
  }

  const t = report.totals;
  pdf.heading('Summary');
  pdf.summary([
    { label: 'Total actions', value: t.all },
    { label: 'By admins', value: t.admin },
    { label: 'By doctors', value: t.doctor },
    { label: 'By patients', value: t.patient },
  ]);

  const tl = report.timeline;
  pdf.heading(tl.unit === 'day' ? 'Actions per day' : 'Actions per month');
  pdf.columnChart(
    tl.buckets.map((b) => ({
      label: tl.unit === 'day' ? formatDayKey(b.key).replace(/, \d{4}$/, '') : formatMonthKey(b.key),
      value: b.count,
    }))
  );

  pdf.heading('Actions by type');
  pdf.table({ head: ['Action', 'Count'], rows: report.byAction.map((a) => [a.label, a.count]), numeric: [1], widths: [5, 1] });

  pdf.heading('Actions by person');
  pdf.table({ head: ['Name', 'Role', 'Count'], rows: report.byActor.map((a) => [a.name, a.role, a.count]), numeric: [2], widths: [4, 1.4, 1] });

  pdf.heading(`Latest ${LATEST_ENTRIES} entries`);
  pdf.table({
    head: ['Time (Manila)', 'Actor', 'Action', 'Target'],
    rows: report.latest.map((e) => [e.at ? manilaDateTime(new Date(e.at)) : '-', `${e.actor} (${e.role})`, e.action, e.target]),
    widths: [1.9, 2.3, 2.6, 2],
  });

  pdf.heading('Notes');
  pdf.note('Counts come from the dashboard audit log for the period, by Philippine date. Details written with an entry are not included. Actions by patients are those the patient app records (requests and cancellations).');

  pdf.save(pdfFileName('activity-summary', manilaDateKey(now)));
}
