// Run: node --import tsx --test src/lib/prenatal-report-csv.test.ts
// (run it under TZ=Asia/Manila and TZ=UTC: the answers must not change)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPrenatalReport, type PrenatalAppointment, type PrenatalPatient } from './prenatal-report';
import { EMPTY_MONTH_NOTE, buildPrenatalCsv, csvField, prenatalCsvRows } from './prenatal-report-csv';

const NOW = new Date('2026-10-24T02:00:00Z');
const visit = (patientUid: string, date: string, over: Partial<PrenatalAppointment> = {}): PrenatalAppointment =>
  ({ patientUid, label: 'Prenatal Checkup', status: 'completed', date, doctorApproval: 'approved', ...over });
const patients: PrenatalPatient[] = [
  { uid: 'uid-adult-123', name: 'Maria Santos Dela Cruz', dob: '1996-05-01', dueDate: '2027-01-20' },
  { uid: 'uid-teen-456', name: 'Ana Reyes', dob: '2007-09-15', dueDate: '2027-01-20' },
  { uid: 'uid-nodob-789', name: 'Liza Bautista', dob: null, dueDate: null },
];
const septAppts = [
  visit('uid-adult-123', '2026-09-01'), visit('uid-adult-123', '2026-09-30'), visit('uid-nodob-789', '2026-09-10', { doctorApproval: 'pending' }),
  visit('uid-teen-456', '2026-09-14'), visit('uid-teen-456', '2026-09-15'), visit('uid-nodob-789', '2026-09-12', { label: 'Other' }),
  visit('uid-nodob-789', '2026-09-20', { status: 'missed' }), visit('uid-adult-123', '2026-08-31'),
];
const report = (month: string, appointments = septAppts, split?: 'clinic' | 'doh') =>
  buildPrenatalReport({ month, appointments, patients, now: NOW, split });
const rowOf = (rows: (string | number)[][], label: string, nth = 0) => rows.filter((r) => r[0] === label)[nth];

/** A small RFC 4180 parser, to read the file back the way a spreadsheet would. */
function parseCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\r' && text[i + 1] === '\n') { row.push(field); out.push(row); row = []; field = ''; i++; }
    else field += ch;
  }
  return out;
}

test('28, 29, 30 and 31-day months: one column per day plus ITEM and TOTAL on every row', () => {
  for (const [month, days] of [['2026-02', 28], ['2028-02', 29], ['2026-09', 30], ['2026-10', 31]] as const) {
    const rows = prenatalCsvRows(report(month));
    const head = rowOf(rows, 'ITEM');
    assert.equal(head.length, days + 2, month);
    assert.deepEqual(head.slice(1, -1), Array.from({ length: days }, (_, i) => i + 1));
    assert.equal(head.at(-1), 'TOTAL');
    assert.ok(rows.every((r) => r.length === days + 2), `${month}: equal widths`);
  }
});

test('weekend marks under their dates', () => {
  const day = rowOf(prenatalCsvRows(report('2026-09')), 'DAY');
  // Sep 5, 2026 is a Saturday, Sep 6 a Sunday, Sep 7 a Monday.
  assert.equal(day[5], 'SAT');
  assert.equal(day[6], 'SUN');
  assert.equal(day[7], '');
  assert.equal(day.filter((x) => x === 'SAT').length, 4);
  assert.equal(day.filter((x) => x === 'SUN').length, 4);
});

test("row order and wording follow the clinic's sheet", () => {
  const labels = prenatalCsvRows(report('2026-09')).map((r) => r[0]);
  const start = labels.indexOf('ITEM');
  assert.deepEqual(labels.slice(start, start + 20), [
    'ITEM', 'DAY', 'I. ADMISSIONS', 'MOTHER', 'NEWBORN', 'CENSUS (PROVISIONAL)', 'II. DELIVERIES', 'STILLBIRTH', 'DISCHARGES', 'MOTHER', 'BABY',
    'III. TRANSFER TO CDH', 'PRENATAL CHECK UP', '19 Y/O ABOVE', '18 Y/O BELOW', 'AGE NOT RECORDED',
    'TOTAL OF DELIVERIES', 'MALE', 'FEMALE', 'PREPARED BY:',
  ]);
  assert.equal(labels[start + 20], 'HEAD OF FACILITY:');
  assert.ok(labels.indexOf('SUMMARY') > labels.indexOf('HEAD OF FACILITY:'));
  assert.ok(labels.indexOf('VISITS BY GESTATIONAL AGE') > labels.indexOf('SUMMARY'));
  assert.ok(labels.indexOf('DATA QUALITY') > labels.indexOf('VISITS BY GESTATIONAL AGE'));
  assert.equal(labels[0], 'SAN JOAQUIN HEALTH STATION AND BIRTHING HOME, CALBAYOG CITY');
  assert.deepEqual(rowOf(prenatalCsvRows(report('2026-09')), 'Month').slice(0, 2), ['Month', 'September 2026']);
});

test('daily and total numbers equal the report JSON; age rows add up', () => {
  const r = report('2026-09');
  const rows = prenatalCsvRows(r);
  const pc = rowOf(rows, 'PRENATAL CHECK UP');
  assert.deepEqual(pc.slice(1, -1), r.daily.map((d) => d.total));
  assert.equal(pc.at(-1), r.totals.visits);
  assert.equal(pc.at(-1), 5);
  const ages = ['19 Y/O ABOVE', '18 Y/O BELOW', 'AGE NOT RECORDED'].map((l) => rowOf(rows, l));
  for (let c = 1; c < pc.length; c++) {
    assert.equal(ages.reduce((s, row) => s + Number(row[c]), 0), Number(pc[c]), `column ${c}`);
  }
  assert.deepEqual(ages.map((row) => row.at(-1)), [3, 1, 1]);
  for (const row of [pc, ...ages]) {
    assert.equal(row.slice(1, -1).reduce((s: number, v) => s + Number(v), 0), row.at(-1));
  }
});

test('rows MomCare cannot fill say "Not recorded", never 0', () => {
  const rows = prenatalCsvRows(report('2026-09'));
  for (const label of ['I. ADMISSIONS', 'NEWBORN', 'CENSUS (PROVISIONAL)', 'II. DELIVERIES', 'STILLBIRTH', 'DISCHARGES', 'BABY', 'III. TRANSFER TO CDH']) {
    const row = rowOf(rows, label);
    assert.ok(row.slice(1, -1).every((v) => v === ''), label);
    assert.equal(row.at(-1), 'Not recorded', label);
  }
  for (const label of ['TOTAL OF DELIVERIES', 'MALE', 'FEMALE']) assert.equal(rowOf(rows, label)[1], 'Not recorded');
  assert.equal(rowOf(rows, 'PREPARED BY:')[1], '');
  assert.ok(rowOf(rows, 'NOT RECORDED IN MOMCARE')[1].toString().includes('Transfers to the district hospital'));
});

test('empty month: real zeros for the prenatal rows and a visible note', () => {
  const rows = prenatalCsvRows(report('2026-07', []));
  const pc = rowOf(rows, 'PRENATAL CHECK UP');
  assert.ok(pc.slice(1).every((v) => v === 0));
  assert.ok(rowOf(rows, '19 Y/O ABOVE').slice(1).every((v) => v === 0));
  assert.deepEqual(rowOf(rows, 'Note').slice(0, 2), ['Note', EMPTY_MONTH_NOTE]);
  assert.ok(!prenatalCsvRows(report('2026-09')).some((r) => r[1] === EMPTY_MONTH_NOTE));
});

test('DOH split uses the configured labels', () => {
  const rows = prenatalCsvRows(report('2026-09', septAppts, 'doh'));
  const labels = rows.map((r) => r[0]);
  const at = labels.indexOf('PRENATAL CHECK UP');
  assert.deepEqual(labels.slice(at + 1, at + 5), ['10-14', '15-19', '20-49', 'AGE NOT RECORDED']);
  assert.ok(!labels.includes('19 Y/O ABOVE'));
});

test('escaping: commas, quotes, line breaks, formula starts; numbers stay plain', () => {
  assert.equal(csvField('a,b'), '"a,b"');
  assert.equal(csvField('say "hi"'), '"say ""hi"""');
  assert.equal(csvField('two\nlines'), '"two\nlines"');
  assert.equal(csvField('=SUM(A1:A2)'), '\t=SUM(A1:A2)');
  assert.equal(csvField('+1'), '\t+1');
  assert.equal(csvField('-1'), '\t-1');
  assert.equal(csvField('@cmd'), '\t@cmd');
  assert.equal(csvField('=a,b'), '"\t=a,b"');
  assert.equal(csvField(42), '42');
  assert.equal(csvField(0), '0');
});

test('file: BOM, CRLF only, parses back to the same rows', () => {
  const r = report('2026-09');
  const text = buildPrenatalCsv(r);
  assert.equal(text.charCodeAt(0), 0xfeff);
  assert.ok(text.endsWith('\r\n'));
  assert.ok(!/[^\r]\n/.test(text.slice(1)), 'no bare LF');
  assert.ok(!/\r(?!\n)/.test(text), 'no stray CR');
  const parsed = parseCsv(text.slice(1));
  const rows = prenatalCsvRows(r);
  assert.equal(parsed.length, rows.length);
  assert.ok(parsed.every((row) => row.length === 32));
  assert.deepEqual(parsed, rows.map((row) => row.map(String)));
  // The no-source list holds commas, so it is quoted in the file.
  assert.ok(text.includes('"Admissions: mother; Admissions: newborn; Admissions: census; Deliveries: total, male, female;'));
});

test('no patient names, ids, birthdays or addresses in the file', () => {
  const text = buildPrenatalCsv(report('2026-09'));
  for (const p of patients) {
    assert.ok(!text.includes(p.name), p.name);
    assert.ok(!text.includes(p.uid), p.uid);
    if (p.dob) assert.ok(!text.includes(p.dob), 'birthday');
  }
  for (const word of ['Santos', 'Reyes', 'Bautista', 'uid-', 'address', 'Address']) assert.ok(!text.includes(word), word);
});
