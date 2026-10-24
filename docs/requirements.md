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

| #   | Assumption                                                                   | Why it is reasonable                                                         |
| --- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| A1  | One level of subtasks in the MVP                                             | Recursion complicates the UI and progress; one level covers the quiz example |
| A2  | "Blocked" is set manually in the MVP; real task dependencies come in Phase 2 | Dependencies need cycle detection and a dedicated UI                         |
| A3  | JSON export is the only backup in the MVP                                    | Simple, inspectable, enough for one user                                     |
| A4  | A project supports at most one goal                                          | Keeps progress unambiguous (a task is never counted twice)                   |
| A5  | Goals and projects are archived, never hard-deleted, once they have children | Protects history and progress data                                           |

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

### Later MVP milestones (criteria written when the milestone starts)

- **M2** Edit, archive, cancel and postpone; subtasks (A1); priorities and due dates in the UI.
- **M3** Dashboard sections: overdue, upcoming, blocked, recently completed.
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
