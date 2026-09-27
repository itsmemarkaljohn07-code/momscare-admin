function csvEscape(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Builds a CSV file from column headers + rows and triggers a browser
 * download. Purely client-side — no server round trip, works on
 * whatever data is already rendered on the page (including active
 * filters, since callers pass the already-filtered array).
 */
export function exportToCsv(
  filename: string,
  columns: string[],
  rows: (string | number | null | undefined)[][]
): void {
  const lines = [
    columns.map(csvEscape).join(','),
    ...rows.map((row) => row.map(csvEscape).join(',')),
  ];
  const csvContent = lines.join('\r\n');
  // Leading BOM so Excel correctly detects UTF-8 instead of guessing
  // and mangling non-ASCII characters (accented names, etc.).
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}