// Pure layout and formatting helpers for the PDF reports (report-pdf.ts).
// No jsPDF or Firebase imports, so they can be unit-tested with plain Node.

/** A4 portrait, millimetres. */
export const PAGE = { width: 210, height: 297, margin: 16, headerHeight: 30, footerHeight: 12 } as const;

/** Content area between header band and footer. */
export const CONTENT = {
  left: PAGE.margin,
  right: PAGE.width - PAGE.margin,
  width: PAGE.width - PAGE.margin * 2,
  top: PAGE.headerHeight + 8,
  bottom: PAGE.height - PAGE.footerHeight - 6,
} as const;

/** The dashboard's light-theme colours (globals.css), as RGB. */
export const COLORS = {
  primary: [217, 82, 127],
  ink: [31, 31, 36],
  muted: [107, 114, 128],
  rule: [229, 231, 235],
  zebra: [248, 248, 250],
  headerFill: [252, 241, 245],
  completed: [62, 99, 166],
  cancelled: [107, 114, 128],
  missed: [179, 54, 74],
  upcoming: [122, 79, 181],
  pending: [183, 121, 31],
  approved: [31, 122, 92],
  chart: [
    [217, 82, 127],
    [79, 168, 148],
    [217, 154, 58],
    [91, 141, 239],
    [155, 111, 196],
  ],
} as const satisfies Record<string, unknown>;

export type Rgb = readonly [number, number, number];

export const CLINIC_TZ = 'Asia/Manila';

/** "Oct 19, 2026, 3:05 PM" in Manila time. */
export function manilaDateTime(now: Date): string {
  return now.toLocaleString('en-US', {
    timeZone: CLINIC_TZ, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

/** Today's date key (YYYY-MM-DD) in Manila. */
export function manilaDateKey(now: Date): string {
  return now.toLocaleDateString('en-CA', { timeZone: CLINIC_TZ });
}

/** "2026-10-19" -> "Oct 19, 2026" (no time-zone shift). */
export function formatDayKey(key: string): string {
  const d = new Date(`${key}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return key;
  return d.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
}

/** "2026-10" -> "Oct 2026". */
export function formatMonthKey(key: string): string {
  const d = new Date(`${key}-01T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return key;
  return d.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', year: 'numeric' });
}

/** The period line under the title. */
export function periodLabel(from: string | null, to: string | null): string {
  if (!from && !to) return 'All time';
  if (from && to) return from === to ? formatDayKey(from) : `${formatDayKey(from)} - ${formatDayKey(to)}`;
  return from ? `From ${formatDayKey(from)}` : `Until ${formatDayKey(to as string)}`;
}

export function pageLabel(page: number, total: number): string {
  return `Page ${page} of ${total}`;
}

/** Bar lengths for a horizontal bar chart: proportional to the largest
 *  value, at least a hairline for any non-zero value, 0 for zero. */
export function barLengths(values: number[], maxLength: number): number[] {
  const max = Math.max(0, ...values);
  if (max <= 0) return values.map(() => 0);
  return values.map((v) => (v <= 0 ? 0 : Math.max(0.6, (v / max) * maxLength)));
}

/** Summary boxes laid out in one row: x positions and a shared width. */
export function boxRow(count: number, totalWidth: number, gap: number): { width: number; xs: number[] } {
  const n = Math.max(1, count);
  const width = (totalWidth - gap * (n - 1)) / n;
  return { width, xs: Array.from({ length: n }, (_, i) => i * (width + gap)) };
}

/** "Report title 2026-10-19" -> "momcare-report-title-2026-10-19.pdf". */
export function pdfFileName(title: string, dateKey: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `momcare-${slug}-${dateKey}.pdf`;
}

// Built-in Helvetica can't draw en/em dashes, so plain hyphens are used.
export const FOOTER_LEFT = 'MomCare · Confidential - contains patient information';
export const EMPTY_LINE = 'No data for this period';
