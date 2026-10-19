// Lays out the appointment report (data from /api/admin/reports/appointments)
// with the shared PDF template. Client-side.

import { ReportPdf } from '@/lib/report-pdf';
import { COLORS, formatDayKey, formatMonthKey, manilaDateKey, pdfFileName, periodLabel } from '@/lib/report-layout';
import type { AppointmentReport } from '@/lib/report-aggregations';

const TITLE = 'Appointment Report';

export async function downloadAppointmentReport(input: {
  report: AppointmentReport;
  generatedBy: string;
  presetLabel: string;
  maxAppointments: number;
}): Promise<void> {
  const { report, generatedBy, presetLabel, maxAppointments } = input;
  const now = new Date(report.generatedAt);
  const pdf = await ReportPdf.create({
    title: TITLE,
    period: periodLabel(report.range.from, report.range.to),
    generatedBy,
    generatedAt: now,
    filters: [`Period: ${presetLabel}`],
  });

  const c = report.counts;
  pdf.heading('Summary');
  pdf.summary([
    { label: 'Total appointments', value: c.total },
    { label: 'Completed', value: c.completed },
    { label: 'Cancelled', value: c.cancelled },
    { label: 'Missed', value: c.missed },
    { label: 'Upcoming', value: c.upcoming },
  ]);
  if (report.capped) {
    pdf.note(`Only the first ${maxAppointments} appointments in the database were read, so these numbers may be incomplete.`);
  }

  pdf.heading('Appointments by status');
  pdf.barChart(
    c.total === 0
      ? []
      : [
          { label: 'Completed', value: c.completed, color: COLORS.completed },
          { label: 'Upcoming', value: c.upcoming, color: COLORS.upcoming },
          { label: 'Cancelled', value: c.cancelled, color: COLORS.cancelled },
          { label: 'Missed', value: c.missed, color: COLORS.missed },
        ]
  );

  pdf.heading('By month');
  pdf.table({
    head: ['Month', 'Total', 'Completed', 'Cancelled', 'Missed', 'Upcoming'],
    rows: report.byMonth.map((m) => [formatMonthKey(m.month), m.total, m.completed, m.cancelled, m.missed, m.upcoming]),
    numeric: [1, 2, 3, 4, 5],
    widths: [3, 1.2, 1.4, 1.4, 1.2, 1.3],
  });

  pdf.heading('By doctor');
  pdf.table({
    head: ['Doctor', 'Total', 'Completed', 'Cancelled', 'Missed'],
    rows: report.byDoctor.map((d) => [d.doctor, d.total, d.completed, d.cancelled, d.missed]),
    numeric: [1, 2, 3, 4],
    widths: [4, 1.2, 1.4, 1.4, 1.2],
  });

  pdf.heading('Cancellation requests');
  pdf.table({
    head: ['Patient', 'Appointment', 'Date', 'Decision'],
    rows: report.cancellations.map((r) => [r.patientName, r.label, formatDayKey(r.date), r.decision]),
    widths: [3, 2.6, 1.8, 2],
  });

  pdf.heading('Notes');
  pdf.note(
    'An appointment counts as missed when it is marked missed, or when it is still upcoming 3 hours after its start time (Philippine time). Dates are appointment dates in Philippine time. Reasons and notes are not included in this report.'
  );

  pdf.save(pdfFileName(TITLE, manilaDateKey(now)));
}
