// Progress calculation (ADR-004).
//
// Rule chosen for the MVP: every task counts the same (option A).
// - "done" tasks count as completed work.
// - "cancelled" tasks are removed from the total: work that will never be done
//   must not make a project look permanently unfinished.
// - A goal's progress is computed over ALL tasks of its projects, not as the
//   average of its projects' percentages. Averaging would give a 1-task project
//   the same weight as a 20-task project, which is exactly the kind of
//   misleading percentage we want to avoid.

import type { Task } from './model';

export interface Progress {
  /** Tasks that are done. */
  done: number;
  /** Tasks that count towards the total (everything except cancelled). */
  total: number;
  /** done / total between 0 and 1, or null when there is nothing to measure yet. */
  ratio: number | null;
}

export function computeProgress(
  tasks: readonly Pick<Task, 'status'>[],
): Progress {
  let done = 0;
  let total = 0;
  for (const task of tasks) {
    if (task.status === 'cancelled') continue;
    total += 1;
    if (task.status === 'done') done += 1;
  }
  // No tasks means "unknown", not 0%: an empty project is not a failing project.
  return { done, total, ratio: total === 0 ? null : done / total };
}
