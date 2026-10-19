// Run: node --import tsx --test src/lib/report-layout.test.ts
// (run it under TZ=Asia/Manila and TZ=UTC: the answers must not change)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTENT, PAGE, barLengths, boxRow, formatDayKey, formatMonthKey, manilaDateKey, manilaDateTime,
  pageLabel, pdfFileName, periodLabel,
} from './report-layout';

test('content area sits inside the page with header and footer room', () => {
  assert.ok(CONTENT.top > PAGE.headerHeight);
  assert.ok(CONTENT.bottom < PAGE.height - PAGE.footerHeight);
  assert.equal(CONTENT.width, PAGE.width - 2 * PAGE.margin);
});

test('Manila date and time, whatever the machine zone', () => {
  const at = new Date('2026-10-18T17:30:00Z'); // Oct 19, 1:30 AM in Manila
  assert.equal(manilaDateKey(at), '2026-10-19');
  assert.equal(manilaDateTime(at), 'Oct 19, 2026, 1:30 AM');
});

test('period and date labels', () => {
  assert.equal(periodLabel(null, null), 'All time');
  assert.equal(periodLabel('2026-10-01', '2026-10-31'), 'Oct 1, 2026 - Oct 31, 2026');
  assert.equal(periodLabel('2026-10-05', '2026-10-05'), 'Oct 5, 2026');
  assert.equal(formatDayKey('2026-01-02'), 'Jan 2, 2026');
  assert.equal(formatMonthKey('2026-02'), 'Feb 2026');
  assert.equal(pageLabel(2, 5), 'Page 2 of 5');
});

test('bar lengths: proportional, hairline for small non-zero, 0 for zero', () => {
  assert.deepEqual(barLengths([10, 5, 0], 100), [100, 50, 0]);
  assert.equal(barLengths([1000, 1], 100)[1], 0.6);
  assert.deepEqual(barLengths([0, 0], 100), [0, 0]);
  assert.deepEqual(barLengths([], 100), []);
});

test('summary boxes fill the row with equal gaps', () => {
  const { width, xs } = boxRow(4, 178, 4);
  assert.equal(xs.length, 4);
  assert.ok(Math.abs(xs[3] + width - 178) < 1e-9);
});

test('file name', () => {
  assert.equal(pdfFileName('Appointment Report', '2026-10-19'), 'momcare-appointment-report-2026-10-19.pdf');
});
