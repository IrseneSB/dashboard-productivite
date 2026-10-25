// Calendar-date helpers. Due dates are calendar days (YYYY-MM-DD) with no
// time zone, so arithmetic is done in UTC to avoid daylight-saving surprises.

import type { IsoDate } from './model';

/** The user's local calendar date for a given instant. */
export function localIsoDate(at: Date): IsoDate {
  const y = at.getFullYear();
  const m = String(at.getMonth() + 1).padStart(2, '0');
  const d = String(at.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * New due date when postponing (assumption A9): move the current due date,
 * or count from today when the task has none. A task that is already overdue
 * is moved from today too: postponing an overdue task by one day should make
 * it due tomorrow, not still in the past.
 */
export function postponedDueDate(
  dueDate: IsoDate | null,
  days: number,
  today: IsoDate,
): IsoDate {
  const start = dueDate === null || dueDate < today ? today : dueDate;
  return addDays(start, days);
}
