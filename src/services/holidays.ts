/**
 * Estonian public holidays (riigipühad).
 *
 * Work on a public holiday is paid at double rate under the Estonian
 * Employment Contracts Act (Töölepingu seadus § 45), so for the Hours screen a
 * public holiday behaves like a weekend: every hour worked counts as overtime.
 *
 * The list is fixed by the Public Holidays and Days of National Importance Act
 * (Pühade ja tähtpäevade seadus) — nine fixed dates plus three tied to Easter.
 * Computing them locally means the phone needs no network for this and can
 * never disagree with the PC app, which derives them from the same rules
 * (see holidays_ee.py in the Kosalma monitor).
 */

/** Western (Gregorian) Easter Sunday — anonymous Gregorian algorithm. */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function key(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

const cache: Record<number, Record<string, string>> = {};

/** The twelve Estonian public holidays for a year, as { YYYYMMDD: english name }. */
export function estonianHolidays(year: number): Record<string, string> {
  if (cache[year]) return cache[year];

  const easter = easterSunday(year);
  const days: Array<[Date, string]> = [
    [new Date(year, 0, 1),    "New Year's Day"],
    [new Date(year, 1, 24),   'Independence Day'],
    [addDays(easter, -2),     'Good Friday'],
    [easter,                  'Easter Sunday'],
    [new Date(year, 4, 1),    'Spring Day'],
    [addDays(easter, 49),     'Pentecost'],
    [new Date(year, 5, 23),   'Victory Day'],
    [new Date(year, 5, 24),   'Midsummer Day'],
    [new Date(year, 7, 20),   'Day of Restoration of Independence'],
    [new Date(year, 11, 24),  'Christmas Eve'],
    [new Date(year, 11, 25),  'Christmas Day'],
    [new Date(year, 11, 26),  'Boxing Day'],
  ];

  const map: Record<string, string> = {};
  days.forEach(([d, name]) => { map[key(d)] = name; });
  cache[year] = map;
  return map;
}

/** The holiday name for a date, or null if it is an ordinary day. */
export function holidayName(date: Date): string | null {
  return estonianHolidays(date.getFullYear())[key(date)] ?? null;
}

/** Weekends and public holidays are both paid entirely as overtime. */
export function isOvertimeDay(date: Date): boolean {
  const dow = date.getDay();
  return dow === 0 || dow === 6 || holidayName(date) !== null;
}
