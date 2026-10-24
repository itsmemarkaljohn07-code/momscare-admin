// Lays out the monthly Prenatal Services report (data from
// /api/admin/reports/prenatal) with the shared PDF template. Client-side.
// An internal draft for the clinic: patient names are not printed.

import { ReportPdf } from '@/lib/report-pdf';
import { formatDayKey, manilaDateKey, pdfFileName } from '@/lib/report-layout';
import {
  DRAFT_LABEL, GESTATION_BANDS, NOT_RECORDED, TRIMESTER_NOTE, UNDER_8, type PrenatalReport,
} from '@/lib/prenatal-report';

/** "2026-09" -> "September 2026". */
export function monthLabel(month: string): string {
  const d = new Date(`${month}-01T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? month : d.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' });
}

const trimesterOf = (label: string) =>
  label === UNDER_8 ? '1st' : label === NOT_RECORDED ? '-' : (['1st', '2nd', '3rd'][(GESTATION_BANDS.find((b) => b.label === label)?.trimester ?? 1) - 1]);

export async function downloadPrenatalReport(input: { report: PrenatalReport; generatedBy: string }): Promise<void> {
  const { report: r, generatedBy } = input;
  const now = new Date(r.generatedAt);
  const pdf = await ReportPdf.create({
    title: 'Prenatal Services Report',
    period: monthLabel(r.month),
    facility: `${r.facility.name}, ${r.facility.location}`,
    notice: DRAFT_LABEL,
    generatedBy,
    generatedAt: now,
  });

  const t = r.totals;
  const notRecordedIdx = r.ageColumns.length - 1;
  pdf.heading('Summary');
  pdf.summary([
    { label: 'Prenatal check-ups (visits)', value: t.visits },
    { label: 'Patients seen (unique)', value: t.uniquePatients },
    { label: 'Visits, age not recorded', value: t.visitsByAge[notRecordedIdx] },
    { label: 'Visits, due date not recorded', value: r.dataQuality.visitsWithoutDueDate },
  ]);

  pdf.heading('Prenatal check-ups per day');
  pdf.table({
    head: ['Date', ...r.ageColumns, 'Total'],
    rows: [
      ...r.daily.map((d) => [formatDayKey(d.date), ...d.byAge, d.total]),
      ['Total', ...t.visitsByAge, t.visits],
    ],
    numeric: r.ageColumns.map((_, i) => i + 1).concat(r.ageColumns.length + 1),
  });
  pdf.note('A visit is a completed "Prenatal Checkup" appointment on that date. Age is in full years on the visit date; "Age not recorded" means the patient has no date of birth in MomCare. Total = all age columns.');

  pdf.heading('Patients seen by age group');
  pdf.table({
    head: ['Age group', 'Visits', 'Unique patients'],
    rows: [...r.ageColumns.map((c, i) => [c, t.visitsByAge[i], t.uniqueByAge[i]]), ['Total', t.visits, t.uniquePatients]],
    numeric: [1, 2],
  });
  pdf.note('Each patient is counted once, in the age group of her first visit of the month.');

  pdf.heading('Visits by gestational age at the visit');
  pdf.table({
    head: ['Weeks', 'Trimester', 'Visits'],
    rows: r.gestation.map((g) => [g.label === UNDER_8 ? 'Under 8' : g.label === NOT_RECORDED ? 'Due date not recorded' : g.label, trimesterOf(g.label), g.visits]),
    numeric: [2],
  });
  pdf.note(TRIMESTER_NOTE);

  pdf.heading('Other rows of the monthly report');
  pdf.table({ head: ['Row', 'Value'], rows: r.noSourceRows.map((row) => [row, NOT_RECORDED]) });
  pdf.note('MomCare has no record for these rows, so they are left as "Not recorded" rather than 0.');

  const q = r.dataQuality;
  pdf.heading('Data quality');
  pdf.table({
    head: ['Check', 'Count'],
    rows: [
      ['Visits by patients without a date of birth (age not recorded)', q.visitsWithoutDob],
      ['Patients without a date of birth', q.patientsWithoutDob.length],
      ['Visits by patients without a due date (gestation not recorded)', q.visitsWithoutDueDate],
      ['Completed visits not approved by the doctor (counted)', q.visitsNotApproved],
      ['"Other" appointments in the month (not counted; check them)', q.otherAppointments],
      ['Prenatal appointments still upcoming (not counted)', q.notCompleted.upcoming],
      ['Prenatal appointments missed (not counted)', q.notCompleted.missed],
      ['Prenatal appointments cancelled (not counted)', q.notCompleted.cancelled],
    ],
    numeric: [1],
  });

  pdf.signatures(['Prepared by (name and signature)', 'Reviewed by: Head of Facility']);

  pdf.save(pdfFileName(`prenatal-services-${r.month}`, manilaDateKey(now)));
}
