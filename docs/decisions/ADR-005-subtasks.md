# ADR-005 — Subtasks: one level, stored in the tasks table

- **Status:** Accepted (2026-10-25), milestone 2
- **Based on:** assumptions A1, A6, A7 in `requirements.md` (not yet confirmed by the owner)

## Context

A task such as "Study for the quiz" is often made of smaller steps ("Chapter 1", "Chapter 2").
The owner chose "every task counts the same" for progress (ADR-004). Subtasks raise three
questions: how to store them, how they count in progress, and what "done" means for a parent.

## Options considered

| Option                                    | Storage                              | Problem                                                                        |
| ----------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------ |
| A. Separate `subtasks` table              | New table, new store methods, new UI | Duplicates almost everything a task already has (status, due date, priority)   |
| **B. `parent_task_id` column on `tasks`** | One nullable column (migration 2)    | Rules involving two rows ("one level", "same project") cannot be a SQL `CHECK` |
| C. Unlimited nesting                      | Same column                          | Recursive UI and progress; no current need                                     |

## Decision

**Option B, one level only.**

1. `tasks.parent_task_id` references `tasks.id`. NULL = top-level task.
2. A subtask always has its parent's `project_id` (so it never appears in the Inbox by mistake).
   Moving a parent moves its subtasks **in one transaction** (`Store.transaction`).
3. A subtask cannot have subtasks.
4. **Progress:** project and goal progress count **top-level tasks only**. The parent shows its
   own "x of y subtasks" line. Counting subtasks as well would count the same work twice (the
   parent and its parts).
5. **A parent cannot be marked done while a subtask is open.** A subtask cannot be added or
   reopened under a done or cancelled parent.
6. **Cancelling a parent cancels its open subtasks** (finished ones keep their status). Because
   reopening the parent does not reopen them, the UI asks for confirmation first. This
   confirmation was added after the code review of milestone 2.

## Where each rule is enforced

| Rule                                                     | Enforced by                                            |
| -------------------------------------------------------- | ------------------------------------------------------ |
| A task is not its own parent                             | SQLite `CHECK (parent_task_id <> id)`                  |
| The parent exists                                        | SQLite foreign key                                     |
| One level; same project as the parent; done/cancel rules | `src/application/use-cases.ts` (involves several rows) |

## Consequences

- A milestone 1 database is upgraded by migration 2 with no data loss (tested: CA-2.9).
- A parent with 10 subtasks still weighs 1 in its project's gauge. If this proves misleading,
  combining with effort weighting (ADR-004, option B) is the natural next step.

## Revisit if

The owner needs deeper nesting, or finds that subtasks should count individually in the gauge.
