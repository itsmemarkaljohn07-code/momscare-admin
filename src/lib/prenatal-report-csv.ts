// The monthly Prenatal Services report as a CSV laid out like the clinic's
// paper monthly report (days across, rows in the clinic's order). Built
// from the same PrenatalReport JSON as the PDF: no second data path, no
// counting here. Pure: no Firebase or browser imports. No patient names,
// birthdays, addresses or ids are ever written.

import {
  AGE_NOT_RECORDED, DRAFT_LABEL, GESTATION_BANDS, NOT_RECORDED, OTHER_AGES, TRIMESTER_NOTE, UNDER_8,
  type PrenatalReport,
} from '@/lib/prenatal-report';
import { CENSUS_NOTE, STAYS_SCOPE_NOTE, type StayRowKey } from '@/lib/stay-report';

const BOM = '﻿';
const CRLF = '\r\n';

/** The clinic sheet's wording for the clinic age split, in its order. */
const CLINIC_AGE_ROWS: { label: string; column: string }[] = [
  { label: '19 Y/O ABOVE', column: '19 and above' },
  { label: '18 Y/O BELOW', column: '18 and below' },
];

/** The clinic sheet's stay rows, in the paper's order, and the stay count
 *  each one shows. On the paper, I. ADMISSIONS is mother + newborn and
 *  DISCHARGES is mother + baby. */
const STAY_GRID_ROWS: [string, StayRowKey][] = [
  ['I. ADMISSIONS', 'admissions'], ['MOTHER', 'admMother'], ['NEWBORN', 'admNewborn'], ['CENSUS (PROVISIONAL)', 'census'],
  ['II. DELIVERIES', 'deliveries'], ['STILLBIRTH', 'stillbirths'],
  ['DISCHARGES', 'discharges'], ['MOTHER', 'disMother'], ['BABY', 'disBaby'], ['III. TRANSFER TO CDH', 'transfers'],
];

export const EMPTY_MONTH_NOTE = 'No completed prenatal check-ups were recorded in MomCare for this month.';

type Cell = string | number;

/** One CSV field: numbers as plain digits; text that a spreadsheet could
 *  run as a formula (=, +, -, @) gets a leading tab; quoted when it holds
 *  a comma, quote or line break, with quotes doubled. */
export function csvField(value: Cell): string {
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  let text = value;
  if (/^[=+\-@]/.test(text)) text = `\t${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** "2026-09" -> "September 2026". */
function monthTitle(month: string): string {
  const d = new Date(`${month}-01T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? month : d.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' });
}

/** "YYYY-MM-DD HH:mm" in Manila. */
function manilaStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  const time = d.toLocaleTimeString('en-GB', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: false });
  return `${date} ${time}`;
}

/** "SAT" / "SUN" for a weekend date key, otherwise ''. */
function weekendMark(dateKey: string): string {
  const day = new Date(`${dateKey}T00:00:00Z`).getUTCDay();
  return day === 6 ? 'SAT' : day === 0 ? 'SUN' : '';
}

/** The age rows of the grid: label shown, and the report column it reads. */
function ageRows(r: PrenatalReport): { label: string; column: string }[] {
  const groups = r.ageColumns.filter((c) => c !== AGE_NOT_RECORDED);
  const rows =
    r.ageSplit === 'clinic' && CLINIC_AGE_ROWS.every((x) => groups.includes(x.column))
      ? [...CLINIC_AGE_ROWS, ...groups.filter((c) => !CLINIC_AGE_ROWS.some((x) => x.column === c)).map((c) => ({ label: c.toUpperCase(), column: c }))]
      : groups.map((c) => ({ label: c === OTHER_AGES ? 'OTHER AGES' : c, column: c }));
  return [...rows, { label: 'AGE NOT RECORDED', column: AGE_NOT_RECORDED }];
}

/** The CSV as rows of cells (for tests and the file). */
export function prenatalCsvRows(r: PrenatalReport): Cell[][] {
  const days = r.daily;
  const width = days.length + 2;
  const pad = (row: Cell[]): Cell[] => [...row, ...Array(Math.max(0, width - row.length)).fill('')];
  const col = (label: string) => r.ageColumns.indexOf(label);
  const rows: Cell[][] = [];

  // 1. Title block.
  rows.push([`${r.facility.name}, ${r.facility.location}`.toUpperCase()]);
  rows.push(['MONTHLY REPORT - PRENATAL SERVICES']);
  rows.push(['Month', monthTitle(r.month)]);
  rows.push(['Status', DRAFT_LABEL]);
  rows.push(['Generated', `${manilaStamp(r.generatedAt)} (Manila time)`]);
  if (r.totals.visits === 0) rows.push(['Note', EMPTY_MONTH_NOTE]);
  rows.push([]);

  // 2. Grid header: days across, weekend marks under their dates.
  rows.push(['ITEM', ...days.map((d) => Number(d.date.slice(8, 10))), 'TOTAL']);
  rows.push(['DAY', ...days.map((d) => weekendMark(d.date)), '']);

  // 3. Rows in the clinic's order.
  // Stay rows: counts from birth stays, or "Not recorded" (never 0) for
  // months before stays were recorded.
  const stayRow = (label: string, key: StayRowKey): Cell[] =>
    r.stays ? [label, ...r.stays.rows[key].daily, r.stays.rows[key].total] : [label, ...days.map(() => ''), NOT_RECORDED];
  for (const [label, key] of STAY_GRID_ROWS) rows.push(stayRow(label, key));
  rows.push(['PRENATAL CHECK UP', ...days.map((d) => d.total), r.totals.visits]);
  for (const a of ageRows(r)) {
    const i = col(a.column);
    rows.push([a.label, ...days.map((d) => (i >= 0 ? d.byAge[i] : 0)), i >= 0 ? r.totals.visitsByAge[i] : 0]);
  }

  // 4. Below the grid, as on the paper.
  if (r.stays) {
    rows.push(['Note', STAYS_SCOPE_NOTE]);
    rows.push(['Note', CENSUS_NOTE]);
  }
  const stayTotal = (key: StayRowKey): Cell => (r.stays ? r.stays.rows[key].total : NOT_RECORDED);
  rows.push(['TOTAL OF DELIVERIES', stayTotal('deliveries')]);
  rows.push(['MALE', stayTotal('liveMale')]);
  rows.push(['FEMALE', stayTotal('liveFemale')]);
  rows.push(['PREPARED BY:', '']);
  rows.push(['HEAD OF FACILITY:', '']);
  rows.push([]);

  // 5. Blocks below the grid.
  rows.push(['SUMMARY']);
  rows.push(['MEASURE', 'VALUE']);
  rows.push(['Prenatal check-ups (visits)', r.totals.visits]);
  rows.push(['Patients seen (unique)', r.totals.uniquePatients]);
  for (const a of ageRows(r)) {
    const i = col(a.column);
    rows.push([`Patients seen (unique): ${a.label}`, i >= 0 ? r.totals.uniqueByAge[i] : 0]);
  }
  rows.push([]);

  rows.push(['VISITS BY GESTATIONAL AGE']);
  rows.push(['WEEKS', 'TRIMESTER', 'VISITS']);
  for (const g of r.gestation) {
    const band = GESTATION_BANDS.find((b) => b.label === g.label);
    const weeks = g.label === UNDER_8 ? 'Under 8' : g.label === NOT_RECORDED ? 'Due date not recorded' : g.label;
    const trimester = g.label === UNDER_8 ? '1st' : band ? ['1st', '2nd', '3rd'][band.trimester - 1] : '';
    rows.push([weeks, trimester, g.visits]);
  }
  rows.push(['Note', TRIMESTER_NOTE]);
  rows.push([]);

  const q = r.dataQuality;
  rows.push(['DATA QUALITY']);
  rows.push(['CHECK', 'COUNT']);
  rows.push(['Visits by patients without a birthday (age not recorded)', q.visitsWithoutDob]);
  rows.push(['Patients without a birthday', q.patientsWithoutDob.length]);
  rows.push(['Visits by patients without a due date (gestation not recorded)', q.visitsWithoutDueDate]);
  rows.push(['Completed visits not approved by the doctor (counted)', q.visitsNotApproved]);
  rows.push(['"Other" appointments in the month (not counted; check them)', q.otherAppointments]);
  rows.push(['Prenatal appointments still upcoming (not counted)', q.notCompleted.upcoming]);
  rows.push(['Prenatal appointments missed (not counted)', q.notCompleted.missed]);
  rows.push(['Prenatal appointments cancelled (not counted)', q.notCompleted.cancelled]);
  rows.push(['Stays without a discharge date (counted present to month end)', r.stays ? r.stays.withoutDischarge.length : NOT_RECORDED]);
  rows.push(['Stays without a delivery recorded', r.stays ? r.stays.withoutOutcome.length : NOT_RECORDED]);
  rows.push(['NOT RECORDED IN MOMCARE', r.noSourceRows.join('; ')]);

  return rows.map(pad);
}

/** The whole file: UTF-8 BOM, CRLF line endings. */
export function buildPrenatalCsv(r: PrenatalReport): string {
  return BOM + prenatalCsvRows(r).map((row) => row.map(csvField).join(',')).join(CRLF) + CRLF;
}
