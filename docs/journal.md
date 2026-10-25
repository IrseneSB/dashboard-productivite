# Development log

Newest first. One entry per significant change, decision revision, or failure.

## 2026-10-25 — Milestone 3: focus sections

- Owner confirmed A6–A9; new assumptions A10–A12 (7-day windows, subtasks included, due today = upcoming).
- `computeFocus` (src/domain/focus.ts) builds Overdue, Upcoming, Blocked and Recently completed;
  `getDashboard` feeds it only visible work, with a context path for each task.
- Focus panel added; the same task now appears twice on screen (panel + tree), so the tree became
  a named region and e2e selectors were scoped to it before they could break.
- First screenshot showed cramped cards (titles wrapping, Cancel overflowing): focus rows made compact.
- Code review: 6 findings, all fixed — stale sections after midnight (reload on focus and at
  midnight), two-call save in the edit dialog (status now saved with the other fields), hard-coded
  "7 days" labels, rolling-hours window for Recently completed (now calendar days), midnight-sensitive
  e2e test, M3 tests in the wrong file.
- An outage of the session's automatic safety check blocked file edits mid-way; work resumed later
  from the exact point it stopped (nothing was lost because nothing had been committed half-done).
- Results: `npm run verify` passed (102 tests); `npm run test:e2e` passed (3 tests).
- Not covered by automated tests: the midnight reload timer (checked by reading the code).

## 2026-10-25 — Milestone 2: edit, archive, cancel, postpone, subtasks

- Criteria CA-2.1 to CA-2.10 and assumptions A6–A9 written before coding. A9 was widened during
  implementation: an overdue task is postponed from today, not from its past due date.
- Migration 2 adds `tasks.parent_task_id`; a test upgrades a real milestone 1 database (CA-2.9).
- `Store` gained `updateGoal`, `updateProject`, `listSubtasks` and `transaction`; ADR-005 written.
- IPC handlers and the preload now loop over `CHANNELS` instead of listing each function.
- The milestone 1 e2e test failed after new buttons were added (ambiguous `getByLabel`); fixed by
  selecting the checkbox by role. The milestone 2 e2e test passed on its first run.
- Independent code review: 10 findings, 9 fixed, 1 kept on purpose (see learning guide, ch. 8).
- Results: `npm run verify` passed (89 tests); `npm run test:e2e` passed (2 tests).
- Not covered by automated tests: the confirmation dialog shown before cancelling a parent task.

## 2026-10-25 — Milestone 1: vertical slice

- Scaffolded with `create-electron-app` 8.0.1 (template `vite` + TypeScript). The documented
  template name `vite-typescript` no longer exists; the tool asked for `--template vite --typescript`.
- Electron 45.0.0 binary download was very slow (about 8 KB/s to GitHub at first); unit tests and
  domain code were written while it downloaded.
- Verified that Electron 45 bundles Node.js 24.22.0 with a working `node:sqlite` (SQLite 3.53.4).
  This resolved the open point in ADR-002.
- npm 11 does not run install scripts unless approved; `electron-winstaller`'s install script was
  skipped. **To check at milestone 6** (Windows installer).
- End-to-end test failed on its first run (`check()` on a controlled checkbox). Diagnosed as a test
  that checked an instant state instead of the saved result; test corrected. Details: learning
  guide, chapter 8.
- Results: `npm run verify` passed (47 tests); `npm run test:e2e` passed.

## 2026-10-25 — Decisions with the owner

D1–D6 recorded in `requirements.md`; ADR-001 to ADR-004 written.
