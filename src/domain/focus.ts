// Focus sections of the dashboard (milestone 3): what is late, what is coming,
// what is stuck, and what was finished recently. Pure function: the caller
// decides which tasks are visible and passes "today" (the user's local date).

import { addDays, daysBetween, localIsoDate } from './dates';
import type { IsoDate, Task } from './model';
import { isOpen } from './task-status';

/** Assumption A10: one-week horizons, easy to change here. */
export const UPCOMING_DAYS = 7;
export const RECENT_DAYS = 7;
export const RECENT_LIMIT = 10;

export interface FocusItem {
  task: Task;
  /** Where the task belongs, outermost first, e.g. ["Semester", "Quiz", "Study"]. Empty = Inbox. */
  context: string[];
}

export interface OverdueItem extends FocusItem {
  daysLate: number;
}

export interface UpcomingItem extends FocusItem {
  /** 0 = due today. */
  daysLeft: number;
}

export interface FocusSections {
  overdue: OverdueItem[];
  upcoming: UpcomingItem[];
  blocked: FocusItem[];
  recentlyCompleted: FocusItem[];
}

export function computeFocus(
  items: readonly FocusItem[],
  today: IsoDate,
): FocusSections {
  const horizon = addDays(today, UPCOMING_DAYS);
  // Calendar days, like Upcoming: today and the 6 days before it (A10).
  // A rolling 7 x 24 h window would move the boundary during the day.
  const recentSince = addDays(today, -(RECENT_DAYS - 1));

  const overdue: OverdueItem[] = [];
  const upcoming: UpcomingItem[] = [];
  const blocked: FocusItem[] = [];
  const recentlyCompleted: FocusItem[] = [];

  for (const item of items) {
    const { task } = item;
    if (isOpen(task)) {
      // ISO dates (YYYY-MM-DD) compare correctly as strings.
      if (task.dueDate !== null && task.dueDate < today) {
        overdue.push({ ...item, daysLate: daysBetween(task.dueDate, today) });
      } else if (task.dueDate !== null && task.dueDate <= horizon) {
        // Assumption A12: due today is upcoming, not overdue.
        upcoming.push({ ...item, daysLeft: daysBetween(today, task.dueDate) });
      }
      if (task.status === 'blocked') blocked.push(item);
    } else if (
      task.status === 'done' &&
      task.completedAt !== null &&
      localIsoDate(new Date(task.completedAt)) >= recentSince
    ) {
      recentlyCompleted.push(item);
    }
  }

  // Ties are broken by title so the order never changes between reloads.
  const byTitle = (a: FocusItem, b: FocusItem) =>
    a.task.title.localeCompare(b.task.title);
  overdue.sort((a, b) => b.daysLate - a.daysLate || byTitle(a, b));
  upcoming.sort((a, b) => a.daysLeft - b.daysLeft || byTitle(a, b));
  blocked.sort(byTitle);
  recentlyCompleted.sort(
    (a, b) =>
      b.task.completedAt!.localeCompare(a.task.completedAt!) || byTitle(a, b),
  );

  return {
    overdue,
    upcoming,
    blocked,
    recentlyCompleted: recentlyCompleted.slice(0, RECENT_LIMIT),
  };
}
