// The List of Pregnant Women as a CSV: the same columns and rows as the
// PDF. UTF-8 with BOM, CRLF, RFC 4180 quoting and the formula guard of the
// monthly report CSV (csvField). Pure: no Firebase or browser imports.

import { csvField } from '@/lib/prenatal-report-csv';
import { FACILITY } from '@/lib/prenatal-report';
import { LIST_COLUMNS, LIST_DRAFT, LIST_SCOPE_NOTE, LIST_TRIMESTER_NOTE, LIST_TITLE, rowCells, type PregnantList } from '@/lib/pregnant-list';

export const EMPTY_LIST_NOTE = 'No pregnant women match on this date.';

/** The CSV as rows of cells (for tests and the file). */
export function pregnantListCsvRows(list: PregnantList): (string | number)[][] {
  const rows: (string | number)[][] = [
    [`${FACILITY.name}, ${FACILITY.location}`.toUpperCase()],
    [LIST_TITLE],
    ['Report date', list.reportDate],
    ['Filter', list.barangay ? `Barangay: ${list.barangay}` : 'All barangays'],
    ['Status', LIST_DRAFT],
    ['CONFIDENTIAL: contains patient information'],
    ['Note', LIST_SCOPE_NOTE],
    ['Note', LIST_TRIMESTER_NOTE],
    [],
    LIST_COLUMNS,
    ...list.rows.map(rowCells),
  ];
  if (list.rows.length === 0) rows.push(['Note', EMPTY_LIST_NOTE]);
  rows.push([]);
  rows.push(['Listed', list.counts.listed]);
  rows.push(['No due date, not listed', list.counts.noDueDate]);
  return rows;
}

export function buildPregnantListCsv(list: PregnantList): string {
  return '﻿' + pregnantListCsvRows(list).map((row) => row.map(csvField).join(',')).join('\r\n') + '\r\n';
}
