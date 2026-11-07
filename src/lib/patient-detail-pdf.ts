// Lays out one patient's report (data from /api/reports/patient/[uid]) with
// the shared PDF template. Client-side. No images, no clinical notes.

import { ReportPdf } from '@/lib/report-pdf';
import { COLORS, formatDayKey, manilaDateKey, pdfFileName, periodLabel } from '@/lib/report-layout';
import { NOT_RECORDED, clinicCharts, type PatientDetailReport } from '@/lib/patient-detail-report';

const show = (v: number | string | null) => (v === null || v === '' ? NOT_RECORDED : String(v));
const day = (key: string) => (key === NOT_RECORDED || !key ? NOT_RECORDED : formatDayKey(key));

export async function downloadPatientDetailReport(input: {
  report: PatientDetailReport;
  generatedBy: string;
  generatorRole: string;
  presetLabel: string;
}): Promise<void> {
  const { report, generatedBy, generatorRole, presetLabel } = input;
  const now = new Date(report.generatedAt);
  const title = `Patient Report: ${report.patientName}`;
  const pdf = await ReportPdf.create({
    title,
    period: periodLabel(report.range.from, report.range.to),
    generatedBy: `${generatedBy} (${generatorRole})`,
    generatedAt: now,
    filters: [`Period: ${presetLabel}`],
    footerNote: `Prepared for clinical use by ${generatedBy} (${generatorRole})`,
  });

  pdf.heading('Profile');
  pdf.keyValues(report.profile.map((p) => ({ label: p.label, value: p.label === 'Due date' && p.value !== NOT_RECORDED ? formatDayKey(p.value) : p.value })));

  const s = report.summary;
  pdf.heading('Summary');
  pdf.summary([
    { label: 'Appointments', value: s.appointments },
    { label: 'Completed', value: s.completed },
    { label: 'Snapshots', value: s.snapshots },
    { label: 'Latest weight', value: s.latestWeight },
    { label: 'Latest BP', value: s.latestBp },
  ]);

  pdf.heading('Appointments');
  pdf.table({
    head: ['Date', 'Time', 'Type', 'Doctor', 'Status', 'Approval'],
    rows: report.appointments.map((a) => [formatDayKey(a.date), a.time, a.type, a.doctor, a.status, a.approval]),
    widths: [1.6, 1.1, 2, 2.2, 1.4, 1.7],
  });

  const labels = report.health.map((h) => (h.date ? formatDayKey(h.date).replace(/, \d{4}$/, '') : ''));
  pdf.heading('Weight');
  pdf.lineChart({ xLabels: labels, unit: 'kg', series: [{ label: 'Weight', values: report.health.map((h) => h.weight), color: COLORS.chart[0] }] });

  pdf.heading('Blood pressure');
  pdf.lineChart({
    xLabels: labels,
    unit: 'mmHg',
    series: [
      { label: 'Systolic', values: report.health.map((h) => h.bpSys), color: COLORS.chart[3] },
      { label: 'Diastolic', values: report.health.map((h) => h.bpDia), color: COLORS.chart[1] },
    ],
  });

  pdf.heading('Reported by the patient (from Snapshots)');
  pdf.table({
    head: ['Date', 'Week', 'Weight (kg)', 'BP', 'Kicks', 'Mood'],
    rows: report.health.map((h) => [
      day(h.date),
      show(h.week),
      show(h.weight),
      h.bpSys !== null && h.bpDia !== null ? `${h.bpSys}/${h.bpDia}` : NOT_RECORDED,
      show(h.kicks),
      show(h.mood),
    ]),
    numeric: [1, 2, 4],
    widths: [1.8, 0.9, 1.3, 1.3, 1, 1.4],
  });

  // Measured at the clinic: values only, no notes, no interpretation.
  pdf.heading('Measured at the clinic');
  if (report.clinic.length === 0) {
    pdf.note('No clinic readings in this period.');
  } else {
    const dash = (v: number | null) => (v === null ? '-' : String(v));
    pdf.table({
      head: ['Date', 'Weight (kg)', 'Blood pressure (mmHg)', 'Fundal height (cm)', 'Fetal heart rate (bpm)', 'Pulse (bpm)', 'Temperature (C)', 'Entered by'],
      rows: report.clinic.map((r) => [
        formatDayKey(r.date),
        dash(r.weightKg),
        r.bpSys !== null && r.bpDia !== null ? `${r.bpSys}/${r.bpDia}` : '-',
        dash(r.fundalHeightCm),
        dash(r.fetalHeartRate),
        dash(r.pulse),
        dash(r.temperatureC),
        r.enteredBy,
      ]),
      numeric: [1, 3, 4, 5, 6],
      widths: [1.7, 1.15, 1.45, 1.2, 1.3, 1, 1.35, 2],
    });
    for (const chart of clinicCharts(report.clinic)) {
      // Keep a chart's heading on the same page as the chart.
      if (!('few' in chart)) pdf.ensureSpace(70);
      pdf.heading(`Clinic: ${chart.title}`);
      if ('few' in chart) {
        pdf.note('Not enough clinic readings for a chart.');
        continue;
      }
      pdf.lineChart({
        xLabels: chart.days.map((d) => formatDayKey(d).replace(/, \d{4}$/, '')),
        unit: chart.unit,
        series: chart.series.map((s, i) => ({ label: s.label, values: s.values, color: COLORS.chart[chart.series.length > 1 ? (i === 0 ? 3 : 1) : 0] })),
      });
    }
  }
  pdf.note('Recorded by the clinic. This report does not interpret the values.');

  pdf.heading('Snapshots');
  pdf.table({
    head: ['Date', 'Type', 'Week', 'Caption'],
    rows: report.snapshots.map((x) => [day(x.date), x.type, x.week, x.caption]),
    widths: [1.6, 1.3, 0.9, 5],
  });

  pdf.heading('Notes');
  pdf.note(
    'Weeks and trimesters use the dashboard rule (280-day model from the due date; trimesters at weeks 0-13, 14-27, 28-40). "Reported by the patient" is what she recorded with each Snapshot; "Measured at the clinic" is what the clinic entered, shown in its own table and charts. Dates are Philippine dates. Photos and clinical notes are not included. "Not recorded" means the value was not provided.'
  );

  const slug = `patient-report-${report.patientName}`;
  pdf.save(pdfFileName(slug, manilaDateKey(now)));
}
