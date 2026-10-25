// "What should I work on now?" (milestone 4, ADR-006).
//
// Deliberately not "smart": a fixed list of rules applied in order, each one
// only breaking the ties of the previous one. The function also returns the
// reasons in plain words, so the user can see why a task was chosen and
// disagree with it.

import { addDays, daysBetween } from './dates';
import type { FocusItem } from './focus';
import type { IsoDate, Priority, Task } from './model';
import { isOpen } from './task-status';

/** Rule 3: "due soon" horizon. */
export const SOON_DAYS = 3;

/**
 * Rules 2 to 6 in plain words, in the order sortKey applies them. Shown under
 * the suggestion; keep in step with sortKey (a test checks the count).
 */
export const RULES: readonly string[] = [
  'overdue first',
  `then due within ${SOON_DAYS} days`,
  'then priority',
  'then the earliest due date',
  'then the oldest task',
];

export interface Suggestion {
  item: FocusItem;
  reasons: string[];
}

export interface NextTask {
  suggestion: Suggestion | null;
  alternatives: Suggestion[];
  /** Shown when there is no suggestion (CA-4.6). */
  emptyReason: string | null;
}

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

/**
 * Rule 1: which tasks can be suggested. `items` must contain only visible
 * work (as for the Focus panel), subtasks included.
 */
function candidates(items: readonly FocusItem[]): FocusItem[] {
  const openSubtaskParents = new Set(
    items
      .filter((i) => i.task.parentTaskId !== null && isOpen(i.task))
      .map((i) => i.task.parentTaskId),
  );
  return items.filter(
    ({ task }) =>
      isOpen(task) &&
      task.status !== 'blocked' &&
      // A parent with open subtasks is done through its subtasks.
      !openSubtaskParents.has(task.id),
  );
}

/** Sort key, rules 2 to 6. Smaller sorts first. */
function sortKey(task: Task, today: IsoDate): (number | string)[] {
  const soon = addDays(today, SOON_DAYS);
  const due = task.dueDate;
  const overdueDays = due !== null && due < today ? daysBetween(due, today) : 0;
  return [
    // Rule 2: overdue first, most days late first.
    overdueDays > 0 ? -overdueDays : 0,
    // Rule 3: due within SOON_DAYS, soonest first.
    due !== null && due >= today && due <= soon
      ? daysBetween(today, due)
      : SOON_DAYS + 1,
    // Rule 4: priority.
    PRIORITY_RANK[task.priority],
    // Rule 5: earliest due date; no date sorts after every date.
    due ?? '9999-12-31',
    // Rule 6: oldest first, then title, so the order is stable.
    task.createdAt,
    task.title,
  ];
}

function compareKeys(a: (number | string)[], b: (number | string)[]): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return 0;
}

/** The reasons a user would accept as "why this one", in rule order. */
function reasonsFor(task: Task, today: IsoDate): string[] {
  const reasons: string[] = [];
  const due = task.dueDate;
  if (due !== null && due < today) {
    const n = daysBetween(due, today);
    reasons.push(`${n} day${n === 1 ? '' : 's'} overdue`);
  } else if (due !== null && due <= addDays(today, SOON_DAYS)) {
    const n = daysBetween(today, due);
    reasons.push(
      n === 0 ? 'due today' : n === 1 ? 'due tomorrow' : `due in ${n} days`,
    );
  }
  if (task.priority === 'high') reasons.push('high priority');
  // Only facts that the rules actually use are given as reasons: "already
  // started" is not a rule, so it is not claimed as one.
  if (reasons.length === 0) {
    reasons.push(
      due === null
        ? 'no due date; older tasks come first'
        : `next due date (${due})`,
    );
  }
  return reasons;
}

export function computeNextTask(
  items: readonly FocusItem[],
  today: IsoDate,
): NextTask {
  const ranked = candidates(items)
    .map((item) => ({ item, key: sortKey(item.task, today) }))
    .sort((a, b) => compareKeys(a.key, b.key))
    .map(({ item }) => ({ item, reasons: reasonsFor(item.task, today) }));

  if (ranked.length === 0) {
    const anyBlocked = items.some((i) => i.task.status === 'blocked');
    return {
      suggestion: null,
      alternatives: [],
      emptyReason: anyBlocked
        ? 'Every open task is blocked. Unblock one to get a suggestion.'
        : 'No open task to suggest (finished projects are skipped). Add a task to get a suggestion.',
    };
  }
  return {
    suggestion: ranked[0],
    alternatives: ranked.slice(1, 3),
    emptyReason: null,
  };
}
