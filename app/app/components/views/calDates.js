'use client';

/* date helpers shared by the activation map's two views */

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
export const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function iso(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function parse(s) {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function daysInMonth(y, m) {
  return new Date(y, m + 1, 0).getDate();
}

/* Monday-first weekday index: 0 = Monday */
export function weekdayMon(y, m, d) {
  return (new Date(y, m, d).getDay() + 6) % 7;
}

export function shortDate(s) {
  if (!s) return '';
  const d = parse(s);
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
}

export function todayISO() {
  const d = new Date();
  return iso(d.getFullYear(), d.getMonth(), d.getDate());
}

/* does an event overlap the given month? */
export function overlapsMonth(start, end, y, m) {
  const a = parse(start);
  const b = end ? parse(end) : a;
  const first = new Date(y, m, 1);
  const last = new Date(y, m, daysInMonth(y, m));
  return a <= last && b >= first;
}

/* how many days of the event fall inside the given month */
export function daysInMonthFor(start, end, y, m) {
  const a = parse(start);
  const b = end ? parse(end) : a;
  const first = new Date(y, m, 1);
  const last = new Date(y, m, daysInMonth(y, m));
  const from = a < first ? first : a;
  const to = b > last ? last : b;
  if (from > to) return 0;
  return Math.round((to - from) / 86400000) + 1;
}
