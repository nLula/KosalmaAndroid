/**
 * Working-hours calculation.
 *
 * Mirrors calculate_day_working_hours() in the Kosalma monitor's app.py and
 * calculateDayWorkingHours() in templates/hours.html — the three must agree, or
 * the phone, the PC screen and the payslip would disagree about the same day.
 */

import { holidayName, isOvertimeDay } from './holidays';

export const LUNCH_MINUTES = 30;
export const LUNCH_THRESHOLD_MINUTES = 4 * 60;      // below this, no lunch deducted
export const NO_LUNCH_THRESHOLD_MINUTES = 10 * 60;  // above this, no lunch deducted
export const REGULAR_WORK_HOURS = 8;

export type DayData = { time?: string; battery?: string };

export type DayHours = {
  regular: number;
  overtime: number;
  holiday: number;     // subset of overtime — hours worked on a public holiday
  total: number;
  start: string | null;
  end: string | null;
  battery: string | null;
  holidayName: string | null;
  isOvertimeDay: boolean;
};

/**
 * Unpaid lunch minutes for a shift of the given clock length.
 *
 * Lunch applies only to the middle of the range: nothing under 4h (too short
 * for a break), 30 minutes from 4h to 10h, nothing over 10h (long shifts keep
 * their full time). Both edges ramp over 30 minutes rather than switching all
 * at once, because a hard switch creates a pay cliff at the boundary — at 4h it
 * would cost 29 minutes to work one minute longer, and at 10h it would hand out
 * 31 free minutes for one extra minute.
 */
export function lunchDeduction(totalShiftMinutes: number): number {
  if (totalShiftMinutes <= LUNCH_THRESHOLD_MINUTES) return 0;
  if (totalShiftMinutes <= NO_LUNCH_THRESHOLD_MINUTES) {
    // ramp in: 0 at 4h00, full 30 min from 4h30 onward
    return Math.min(LUNCH_MINUTES, totalShiftMinutes - LUNCH_THRESHOLD_MINUTES);
  }
  // ramp out: full 30 min at 10h00, 0 from 10h30 onward
  return Math.max(0, LUNCH_MINUTES - (totalShiftMinutes - NO_LUNCH_THRESHOLD_MINUTES));
}

/** Minutes actually paid for a shift of the given clock length. */
export function paidMinutes(totalShiftMinutes: number): number {
  return totalShiftMinutes - lunchDeduction(totalShiftMinutes);
}

function parseTimeMins(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return isNaN(h) || isNaN(m) ? NaN : h * 60 + m;
}

export function calcDayHours(dayData: DayData | undefined, date: Date): DayHours {
  const holiday = holidayName(date);
  const overtimeDay = isOvertimeDay(date);
  const empty: DayHours = {
    regular: 0, overtime: 0, holiday: 0, total: 0,
    start: null, end: null, battery: null,
    holidayName: holiday, isOvertimeDay: overtimeDay,
  };

  if (!dayData?.time) return empty;

  const battery = dayData.battery ?? null;
  const times = dayData.time.split(';').map(t => t.trim()).filter(Boolean);
  if (!times.length) return { ...empty, battery };

  const start = times[0];
  const end = times.length > 1 ? times[times.length - 1] : null;
  if (!end) return { ...empty, start, battery };

  const startM = parseTimeMins(start);
  const endM = parseTimeMins(end);
  if (isNaN(startM) || isNaN(endM)) return { ...empty, start, end, battery };

  let totalMins = endM - startM;
  if (totalMins < 0) totalMins += 24 * 60;   // shift crossed midnight

  const paidHours = paidMinutes(totalMins) / 60;

  let regular = 0;
  let overtime = 0;
  if (overtimeDay) {
    // Every hour worked on a weekend or public holiday counts as overtime
    overtime = paidHours;
  } else {
    // Weekday: the first 8 paid hours are regular, the rest overtime
    regular = Math.min(REGULAR_WORK_HOURS, paidHours);
    overtime = Math.max(0, paidHours - REGULAR_WORK_HOURS);
  }

  return {
    regular,
    overtime,
    holiday: holiday ? overtime : 0,
    total: regular + overtime,
    start,
    end,
    battery,
    holidayName: holiday,
    isOvertimeDay: overtimeDay,
  };
}

export function fmtHours(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
