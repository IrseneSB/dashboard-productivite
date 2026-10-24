// Task lifecycle: which status changes are allowed, and what each change implies.
//
//   todo <-> in_progress <-> blocked
//     \          |           /
//      +----> done / cancelled  (both can be reopened to todo)

import type { IsoDateTime, Task, TaskStatus } from './model';
import { ValidationError } from './validation';

const ALLOWED: Record<TaskStatus, readonly TaskStatus[]> = {
  todo: ['in_progress', 'blocked', 'done', 'cancelled'],
  in_progress: ['todo', 'blocked', 'done', 'cancelled'],
  blocked: ['todo', 'in_progress', 'done', 'cancelled'],
  done: ['todo'],
  cancelled: ['todo'],
};

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return ALLOWED[from].includes(to);
}

/**
 * Returns the task with its new status. Pure function: the caller decides
 * whether and where to save the result.
 */
export function transitionTask(
  task: Task,
  to: TaskStatus,
  now: IsoDateTime,
): Task {
  if (task.status === to) return task;
  if (!canTransition(task.status, to)) {
    throw new ValidationError(
      'status',
      `A task cannot go from "${task.status}" to "${to}".`,
    );
  }
  return {
    ...task,
    status: to,
    // completedAt records when the work was finished; reopening erases it.
    completedAt: to === 'done' ? now : null,
    updatedAt: now,
  };
}
