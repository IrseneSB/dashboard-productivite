# Requirements

Status of each item: **Confirmed** (stated or approved by the owner) · **Assumption** (reasonable
default, not confirmed, easy to change) · **Open** (unanswered) · **Excluded** (deliberately not in
the MVP).

## Objective

A personal desktop dashboard that shows what to work on, why, what is done, and what remains
before reaching long-term goals, by linking goals → projects → tasks. **Confirmed.**

## Decisions taken with the owner (2026-10-25)

| #   | Question                            | Answer                                                                                                                           | Status    |
| --- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------- |
| D1  | Desktop technology                  | Electron + TypeScript (no Rust toolchain)                                                                                        | Confirmed |
| D2  | Can a task exist outside a project? | Yes, in an Inbox                                                                                                                 | Confirmed |
| D3  | How is progress measured?           | Shown as a gauge; every task counts the same (option A)                                                                          | Confirmed |
| D4  | Startup behavior                    | Opens the normal window at login; optional setting offered on first launch; no tray, no background process                       | Confirmed |
| D5  | Language                            | English for UI, code and documentation                                                                                           | Confirmed |
| D6  | Location and publication            | `C:\Users\DC\projets\dashboard-productivite`; public GitHub repo under the owner's account, created only after explicit approval | Confirmed |

## Assumptions (change any of them by asking)

**A6–A9 were confirmed by the owner on 2026-10-25** after milestone 2. A1–A5 remain assumptions.
New assumptions for milestone 3: A10–A12 below.

| #   | Assumption                                                                                                               | Why it is reasonable                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| A1  | One level of subtasks in the MVP                                                                                         | Recursion complicates the UI and progress; one level covers the quiz example                          |
| A2  | "Blocked" is set manually in the MVP; real task dependencies come in Phase 2                                             | Dependencies need cycle detection and a dedicated UI                                                  |
| A3  | JSON export is the only backup in the MVP                                                                                | Simple, inspectable, enough for one user                                                              |
| A4  | A project supports at most one goal                                                                                      | Keeps progress unambiguous (a task is never counted twice)                                            |
| A5  | Goals and projects are archived, never hard-deleted, once they have children                                             | Protects history and progress data                                                                    |
| A6  | Goal and project progress count top-level tasks only; subtasks show their own "2 of 5" on the parent                     | Keeps option A ("every task counts the same") without counting a parent and its parts twice (ADR-005) |
| A7  | A parent task cannot be marked done while it has open subtasks                                                           | Prevents a "done" task whose work is visibly unfinished                                               |
| A8  | No hard delete of tasks in the MVP: a task created by mistake is cancelled                                               | Cancelled tasks leave progress untouched; delete can come later with an undo                          |
| A9  | "Postpone" moves the due date by 1 day or 1 week, starting from today when the task has no due date or is overdue        | Two quick actions cover the common cases; any other date is set by editing                            |
| A10 | "Upcoming" = due today or in the next 7 days; "recently completed" = done in the last 7 days (at most 10 shown)          | A one-week horizon matches a weekly study rhythm; both numbers are constants that are easy to change  |
| A11 | Focus sections include subtasks (shown with their parent's name) and exclude anything inside an archived goal or project | Subtasks are real work with their own dates; archived work was set aside on purpose                   |
| A12 | A task due today is "upcoming (today)", not overdue                                                                      | It can still be done on time                                                                          |

## MVP features and acceptance criteria

Milestone numbers refer to the roadmap below. `CA-x.y` identifiers are used in test names.

### Milestone 1 — vertical slice

| Id     | Acceptance criterion                                                                                       | Verified by                                                              |
| ------ | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| CA-1.1 | After creating a goal, a project under it and a task, the dashboard shows the goal with "0 of 1 task done" | `use-cases.test.ts`, `tests/e2e/vertical-slice.e2e.ts` (real app)        |
| CA-1.2 | Marking the task done updates the dashboard to "1 of 1" / 100% without restarting                          | same                                                                     |
| CA-1.3 | Data is still there after closing and reopening the app                                                    | `sqlite-store.test.ts` (reopen), `vertical-slice.e2e.ts` (app restart)   |
| CA-1.4 | An empty title is refused with a clear message                                                             | `tests/domain/validation.test.ts`, `tests/application/use-cases.test.ts` |
| CA-1.5 | Progress is unknown (not 0%) with no tasks; cancelled tasks do not count                                   | `tests/domain/progress.test.ts`                                          |
| CA-1.6 | The SQLite store passes the same contract tests as the in-memory store                                     | `tests/data/sqlite-store.test.ts`                                        |

### Milestone 2 — edit, archive, cancel, postpone, subtasks

| Id      | Acceptance criterion                                                                                                                                     | Verified by                                     |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| CA-2.1  | A goal, a project or a task can be edited (title, description or notes, dates, priority); invalid values are refused with a message and nothing is saved | `use-cases.test.ts`, `edit-and-subtasks.e2e.ts` |
| CA-2.2  | A goal or project can be archived: it leaves the dashboard, appears in the Archived section, and can be restored with its projects and tasks             | `use-cases.test.ts`, `edit-and-subtasks.e2e.ts` |
| CA-2.3  | Nothing can be added under an archived goal or project                                                                                                   | `use-cases.test.ts`                             |
| CA-2.4  | A task can be cancelled; it stays visible as cancelled and no longer counts in progress                                                                  | `use-cases.test.ts`, `edit-and-subtasks.e2e.ts` |
| CA-2.5  | A task can be postponed by 1 day or 1 week; without a due date, the new date counts from today                                                           | `postpone.test.ts`, `use-cases.test.ts`         |
| CA-2.6  | A task can have subtasks (one level); the parent shows "x of y subtasks done"; project progress counts the parent only                                   | `use-cases.test.ts`, `edit-and-subtasks.e2e.ts` |
| CA-2.7  | A parent cannot be marked done while a subtask is open; a subtask cannot be added or reopened under a done parent                                        | `use-cases.test.ts`                             |
| CA-2.8  | Moving a task to another project moves its subtasks with it, in one transaction                                                                          | `use-cases.test.ts`, `sqlite-store.test.ts`     |
| CA-2.9  | A database created by milestone 1 is upgraded to the new schema without losing data                                                                      | `sqlite-store.test.ts` (migration 1 → 2)        |
| CA-2.10 | Priority and due date can be set when creating a task and are shown in the task list                                                                     | `edit-and-subtasks.e2e.ts`                      |

### Milestone 3 — focus sections on the dashboard

| Id     | Acceptance criterion                                                                                         | Verified by                            |
| ------ | ------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| CA-3.1 | **Overdue** lists open tasks whose due date is before today, oldest first, with "N days late"                | `focus.test.ts`, `focus.e2e.ts`        |
| CA-3.2 | **Upcoming** lists open tasks due from today to 7 days ahead, soonest first; a task due today says "today"   | `focus.test.ts`, `focus.e2e.ts`        |
| CA-3.3 | **Blocked** lists open tasks with status blocked; a task can be set to blocked and back from the edit dialog | `focus.test.ts`, `focus.e2e.ts`        |
| CA-3.4 | **Recently completed** lists tasks done in the last 7 days, newest first, at most 10                         | `focus.test.ts`, `focus.e2e.ts`        |
| CA-3.5 | Each item shows where it belongs (goal › project › parent task, or Inbox)                                    | `focus.test.ts`, `focus.e2e.ts`        |
| CA-3.6 | Done, cancelled and archived work never appears in Overdue, Upcoming or Blocked                              | `focus.test.ts`, `milestone-3.test.ts` |
| CA-3.7 | An empty section says so in one line instead of disappearing                                                 | `focus.e2e.ts`                         |

### Later MVP milestones (criteria written when the milestone starts)

- **M4** "What should I work on now?" — rule-based suggestion with its reason shown.
- **M5** Settings: start at login (D4); JSON export (A3).
- **M6** Packaging (Windows installer), install and startup verification, GitHub publication.

## Excluded from the MVP

| Feature                                                    | Why it waits                                                       |
| ---------------------------------------------------------- | ------------------------------------------------------------------ |
| Notifications and reminders                                | Require a background process; the app does not need to run all day |
| Cloud sync, accounts                                       | No demonstrated need; adds authentication and a server             |
| AI-assisted planning                                       | Transparent rules first; AI only if the rules prove insufficient   |
| Calendar view, recurring tasks, focus timer, weekly review | Phase 2–3, once the core workflow is used                          |
| Task dependencies                                          | Phase 2 (see A2)                                                   |

## Open questions

None blocking milestone 1.
