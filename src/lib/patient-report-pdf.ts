// Lays out the patient summary report (data from /api/admin/reports/patients)
// with the shared PDF template. Client-side.

import { ReportPdf } from '@/lib/report-pdf';
import { formatDayKey, formatMonthKey, manilaDateKey, pdfFileName } from '@/lib/report-layout';
import type { PatientReport } from '@/lib/report-aggregations';

const TITLE = 'Patient Summary';

export async function downloadPatientReport(input: { report: PatientReport; generatedBy: string }): Promise<void> {
  const { report, generatedBy } = input;
  const now = new Date(report.generatedAt);
  const pdf = await ReportPdf.create({
    title: TITLE,
    period: `As of ${formatDayKey(report.asOf)}`,
    generatedBy,
    generatedAt: now,
    filters: ['All registered patients'],
  });

  const s = report.summary;
  pdf.heading('Summary');
  pdf.summary([
    { label: 'Total patients', value: s.total },
    { label: 'Active', value: s.active },
    { label: 'Suspended', value: s.suspended },
    { label: 'With a due date', value: s.withDueDate },
  ]);

  pdf.heading('Patients by trimester');
  pdf.barChart(s.total === 0 ? [] : report.byTrimester.map((b) => ({ label: b.label, value: b.count })));

  pdf.heading('Patients by assigned doctor');
  pdf.barChart(report.byDoctor.map((b) => ({ label: b.label, value: b.count })));

  pdf.heading('Patients by due month');
  pdf.barChart(s.total === 0 ? [] : report.byDueMonth.map((b) => ({ label: b.month ? formatMonthKey(b.month) : b.label, value: b.count })));

  pdf.heading('Due in the next 60 days');
  pdf.table({
    head: ['Patient', 'Week', 'Due date', 'Doctor'],
    rows: report.dueSoon.map((r) => [r.name, r.week === null ? '-' : r.week, formatDayKey(r.dueDate), r.doctors]),
    numeric: [1],
    widths: [3, 0.9, 1.6, 3],
  });

  pdf.heading('Notes');
  pdf.note(
    'Pregnancy week is counted from the due date with the 280-day (40-week) model, in completed weeks, as on the dashboard. Trimesters: weeks 0-13 first, 14-27 second, 28-40 third; a due date that has passed counts as week 40. A patient with several assigned doctors is counted under each. Dates are Philippine dates. No emails, phone numbers or health readings are included.'
  );

  pdf.save(pdfFileName(TITLE, manilaDateKey(now)));
}
