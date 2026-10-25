# Engineering learning guide

How this application was built, decision by decision. It describes the **actual** code in this
repository and is updated at every milestone.

**State of this guide:** updated at the end of **milestone 4** ("what should I work on now?"). Chapters marked
_planned_ describe work that has not been done yet.

---

## Chapter 1 — From idea to requirements

### The problem

Tasks usually live in flat lists. A flat list cannot answer "why am I doing this?" or "how close
am I to my goal?". The application links three levels:

```
Long-term goal   "Prepare successfully for the semester"
  └─ Project     "Software Testing quiz"
       └─ Task   "Review the main concepts"
```

### How the description became requirements

The original description was sorted into categories (see [`requirements.md`](requirements.md)):

1. **Confirmed** — what the owner explicitly asked for or approved (decisions D1–D6).
2. **Assumptions** — reasonable interpretations, written down so they can be challenged (A1–A5).
   Example: "one level of subtasks" is an assumption, not something the owner said.
3. **Excluded** — features deliberately postponed, each with a reason.

### Which questions were asked, and which were not

Only questions whose answer changes the design were asked before coding:

| Question                            | Why it mattered                                                |
| ----------------------------------- | -------------------------------------------------------------- |
| Tauri or Electron?                  | Changes the toolchain, the languages and the packaging         |
| Can a task exist without a project? | Changes the database schema (`project_id` nullable or not)     |
| How is progress measured?           | Changes the formula and what the gauge means                   |
| What happens at login?              | Background process or not: changes complexity and resource use |

Questions with a cheap, reversible answer (colors, button labels) were not asked: a default was
chosen and can be changed later.

### Acceptance criteria

Each feature gets criteria that a test can check. A good criterion describes an **observable
result**: "the dashboard shows _0 of 1 task done_" can be tested; "progress is clear" cannot.
Criteria have identifiers (`CA-1.1` …) that appear in the test names, so a search for `CA-1.3`
finds both the requirement and the test that proves it.

---

## Chapter 2 — Technology selection

See [ADR-001](decisions/ADR-001-technology-stack.md) for the full comparison.

- **Electron** runs a web UI (Chromium) and a Node.js process inside one desktop app.
- **React** builds the UI from components (functions that return what to display).
- **TypeScript** adds types to JavaScript: many mistakes (a missing field, a wrong argument) are
  caught by `npm run typecheck` before the app runs.
- **Vite** bundles the code; **Electron Forge** runs the app in development and packages it.
- **SQLite** via Node's built-in `node:sqlite` stores the data in one local file.
- **Vitest** runs the tests; **Playwright** drives the real app for end-to-end tests.

**Main trade-off:** Electron is heavier than Tauri (it ships its own browser engine), but needs no
Rust toolchain and keeps the whole project in one language. If the app had to run in the
background all day, the memory cost would weigh more and Tauri would become the better choice.

---

## Chapter 3 — Architecture and design

### Electron's two processes

Electron always has (at least) two processes, and this shapes everything:

| Process      | Can do                                       | Runs here                                                   |
| ------------ | -------------------------------------------- | ----------------------------------------------------------- |
| **Main**     | Node.js: files, database, operating system   | `src/main/`, `src/application/`, `src/data/`, `src/domain/` |
| **Renderer** | Display a web page, sandboxed like a website | `src/ui/`                                                   |

The renderer is deliberately **not** allowed to touch the database or the file system
(`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` in `src/main/main.ts`). If a
bug or a malicious string ever ran code in the UI, it could still only call the five functions
the app exposes.

### The layers

```
 Renderer process                     │  Main process
                                      │
 src/ui (React)                       │  src/main/ipc.ts ── handlers, Result conversion
   │ window.api.createTask(...)       │        │
   ▼                                  │        ▼
 src/preload/preload.ts ── IPC ──────────▶ src/application/use-cases.ts
   (contextBridge)                    │        │                  │
                                      │        ▼                  ▼
 src/shared/api.ts                    │  src/domain/*      src/application/store.ts (interface)
   (contract used by both sides)      │  (pure rules)             ▲
                                      │                           │ implements
                                      │                    src/data/sqlite-store.ts → dashboard.db
```

How to read it: arrows point from the caller to the code it calls. `domain` has no arrows going
out: it depends on nothing, which is why it can be tested in isolation.

### Responsibilities

| Module         | Responsibility                                                     | Must not                         |
| -------------- | ------------------------------------------------------------------ | -------------------------------- |
| `domain/`      | Entities, validation, status transitions, progress formula         | Import Electron, SQLite or React |
| `application/` | One function per user action; checks that referenced records exist | Know how data is stored          |
| `data/`        | Read and write rows; schema migrations                             | Contain business rules           |
| `main/`        | Create the window, open the database, register IPC handlers        | Contain business rules           |
| `preload/`     | Expose `window.api` and nothing else                               | Expose `ipcRenderer` itself      |
| `shared/`      | Types and channel names shared by both processes                   | Contain logic                    |
| `ui/`          | Display data and send user actions                                 | Access the database              |

### Alternatives rejected

- **Putting the database in the renderer** (e.g. SQLite compiled to WebAssembly): simpler at
  first, but the UI would then own the data and every rule would have to be enforced in the UI.
- **One class per entity with repositories and services**: more files, no benefit at this size.
  The single `Store` interface is enough ([ADR-003](decisions/ADR-003-module-boundaries.md)).

---

## Chapter 4 — Data modeling

### Entities (migration 1, `src/data/migrations.ts`)

| Table      | Key              | Points to                                  | Notes                              |
| ---------- | ---------------- | ------------------------------------------ | ---------------------------------- |
| `goals`    | `id` (UUID text) | —                                          | status: active, achieved, archived |
| `projects` | `id`             | `goal_id` → `goals.id`, **nullable**       | NULL = project without a goal      |
| `tasks`    | `id`             | `project_id` → `projects.id`, **nullable** | NULL = task in the Inbox           |

**Why tasks point to a project and not to a goal as well.** If a task could reference both a
project and a goal, the two could disagree (a task in project P of goal G, but pointing to goal H).
With a single reference, the goal of a task is always _derived_: task → project → goal. There is
only one truth.

**Why UUIDs instead of 1, 2, 3.** IDs are created in code (`crypto.randomUUID()`) before the row
is saved, so the use case knows the ID immediately, and IDs never collide if data is later
imported from an export.

### Constraints that protect the data

Even if the TypeScript code had a bug, SQLite refuses invalid data:

```sql
status       TEXT NOT NULL CHECK (status IN ('todo', 'in_progress', 'blocked', 'done', 'cancelled')),
-- A task has a completion time if and only if it is done.
completed_at TEXT CHECK ((status = 'done') = (completed_at IS NOT NULL)),
```

- The first `CHECK` limits `status` to known values.
- The second compares two booleans: "status is done" must equal "completed_at is set". A done task
  without a date, or a todo task with one, is rejected.
- `REFERENCES projects(id) ON DELETE RESTRICT` plus `PRAGMA foreign_keys = ON` means a task cannot
  point to a project that does not exist, and a project with tasks cannot be deleted.

Tests in `tests/data/sqlite-store.test.ts` insert invalid rows on purpose and check that SQLite
refuses them.

### How progress is calculated

See [ADR-004](decisions/ADR-004-progress-calculation.md) and `src/domain/progress.ts`:
progress = done tasks ÷ tasks that are not cancelled; no tasks → "unknown", not 0%; a goal counts
all the tasks of all its projects (not the average of the projects).

### Schema changes

`migrate()` reads SQLite's `PRAGMA user_version`, runs every newer migration inside a transaction,
and stores the new version. A failed migration is rolled back. A test runs a deliberately broken
migration and checks that the database is left unchanged.

---

## Chapter 5 — Project structure

```
src/
  domain/          model.ts, validation.ts, task-status.ts, progress.ts, dates.ts
  application/     store.ts (interface), use-cases.ts
  data/            migrations.ts, sqlite-store.ts, memory-store.ts
  main/            main.ts (entry point), ipc.ts
  preload/         preload.ts
  shared/          api.ts (IPC contract)
  ui/              main.tsx (entry), App.tsx, useAction.ts, projectOptions.ts, styles.css
    components/    Gauge, QuickAddForm, TaskItem, EditDialog
tests/
  domain/          pure rules
  application/     use cases with the in-memory store
  data/            the real SQLite store, constraints, migrations
  e2e/             the packaged app driven by Playwright (helpers.ts shared)
docs/
  requirements.md, learning-guide.md, journal.md, process-evaluation.md
  decisions/       ADR-001 … ADR-006
forge.config.mts   how Electron Forge builds and packages the app
vite.*.config.mts  one bundler configuration per process (main, preload, renderer)
vitest*.config.mts unit/integration tests, and end-to-end tests
```

---

## Chapter 6 — Implementation walkthrough

### Milestone 1: the vertical slice

**Requirement:** CA-1.1 to CA-1.6 — create goal → project → task, complete the task, see the
progress, keep the data after a restart.

**Order of work, and why:**

1. **Domain rules first** (`src/domain/`) with their tests. They are the easiest to test and
   everything else depends on them.
2. **Use cases** with an in-memory store: the whole workflow was proven before any database existed.
3. **SQLite store** tested against the same contract as the in-memory store.
4. **IPC and UI** last, once the logic underneath was known to work.
5. **End-to-end test** to prove the pieces work together in the real app.

**A key code section — status transitions** (`src/domain/task-status.ts`):

```ts
const ALLOWED: Record<TaskStatus, readonly TaskStatus[]> = {
  todo: ['in_progress', 'blocked', 'done', 'cancelled'],
  // ...
  done: ['todo'],
  cancelled: ['todo'],
};
```

The allowed transitions are **data**, not scattered `if` statements. Adding a status later means
editing one table, and `Record<TaskStatus, …>` makes TypeScript complain if a status is forgotten.

```ts
return {
  ...task,
  status: to,
  completedAt: to === 'done' ? now : null,
  updatedAt: now,
};
```

The function returns a **new** object instead of modifying the task (a _pure function_). The
caller decides whether to save it. `now` is passed in rather than read from the clock, so tests
can use a fixed time.

**How to extend safely:** add the transition to `ALLOWED`, add a test in
`tests/domain/task-status.test.ts`, and run `npm run verify`.

### Milestone 2: edit, archive, cancel, postpone, subtasks

**Requirements:** CA-2.1 to CA-2.10 in `requirements.md`.

**Order of work:** criteria and assumptions first (A6–A9), then the schema change (migration 2),
then the store, the use cases and their tests, and only then the UI and the end-to-end test.

**Design decision — subtasks** ([ADR-005](decisions/ADR-005-subtasks.md)): a nullable
`parent_task_id` column instead of a new table. Rules that involve two rows ("one level only",
"same project as the parent") cannot be SQL `CHECK` constraints, so they live in the use cases.

**Key code — moving a task with its subtasks** (`updateTask` in `src/application/use-cases.ts`):

```ts
return store.transaction(() => {
  const moved = { ...updated, projectId };
  store.updateTask(moved);
  for (const subtask of subtasksOf(task.id)) {
    store.updateTask({ ...subtask, projectId, updatedAt: at });
  }
  return moved;
});
```

Several rows change for one user action. Without a transaction, a failure halfway would leave
the parent in one project and some subtasks in another. `store.transaction` makes the whole
block succeed or fail as one unit (`BEGIN` / `COMMIT` / `ROLLBACK` in SQLite, a snapshot in the
in-memory store). A contract test checks that both stores undo every write when the block throws.

**Key code — partial updates.** `UpdateTaskInput` is `Partial<…>`: a field that is `undefined`
is left unchanged, `null` clears an optional date. Every given field is validated **before**
`store.updateTask` runs, so an invalid due date never saves a half-edited task (CA-2.1).

**Key code — one IPC loop.** `registerIpcHandlers` (`src/main/ipc.ts`) now registers every
channel in `CHANNELS` with a loop, because each API function has a use case of the same name.
Adding a feature means: write the use case, add it to `DashboardApi` and `CHANNELS`; TypeScript
refuses a channel without a matching API function (`satisfies Record<keyof DashboardApi, string>`).

**UI pattern — `useAction`.** Every button follows the same steps: call the main process, show
the refusal message or reload the dashboard. `createRunAction` writes this once, and React
context gives it to nested components (`TaskItem`) without passing callbacks through every level.

**How to extend safely:** a new task action = a use case + its tests, an entry in `DashboardApi`
and `CHANNELS`, a button calling `run(() => window.api.…)`, and a step in an e2e test.

### Milestone 3: focus sections

**Requirements:** CA-3.1 to CA-3.7; assumptions A10–A12.

**Design decision — a pure function for the sections.** `computeFocus(items, today)` in
`src/domain/focus.ts` receives the visible tasks with their context and the user's local date,
and returns the four lists. Because it takes `today` as a parameter instead of reading the clock,
the tests can check every boundary (due today, 7 days ahead, 8 days ahead) with fixed dates.

```ts
if (task.dueDate !== null && task.dueDate < today) {
  overdue.push({ ...item, daysLate: daysBetween(task.dueDate, today) });
} else if (task.dueDate !== null && task.dueDate <= horizon) {
  upcoming.push({ ...item, daysLeft: daysBetween(today, task.dueDate) });
}
```

ISO dates (`YYYY-MM-DD`) sort the same way as text, so `<` and `<=` on strings compare dates
correctly. `daysBetween` works in UTC on calendar days, so daylight-saving changes cannot turn
"1 day" into 0.96 days.

**Where "visible" is decided.** `getDashboard` walks the same goal → project → task structure it
already built for the tree, and collects only those tasks. Archived work is therefore excluded
from the Focus panel by construction, not by a second filter that could drift from the first.

**Time in a long-running app.** The dashboard is computed when it is loaded. An app that opens at
login may stay open for days, so `App.tsx` reloads when the window regains focus and just after
each local midnight. This was found by the code review, not by a test: tests run for seconds.

### Milestone 4: "What should I work on now?"

**Requirements:** CA-4.1 to CA-4.6; design in [ADR-006](decisions/ADR-006-next-task-rules.md).

**Technique — a lexicographic sort key.** Each task gets a list of values, one per rule, and lists
are compared element by element, like words in a dictionary:

```ts
return [
  overdueDays > 0 ? -overdueDays : 0, // rule 2: more days late sorts first
  dueSoon ? daysBetween(today, due) : SOON_DAYS + 1, // rule 3
  PRIORITY_RANK[task.priority], // rule 4: high = 0, low = 2
  due ?? '9999-12-31', // rule 5: no date sorts last
  task.createdAt, // rule 6: oldest first
  task.title, // stable tie-breaker
];
```

The second value only matters when the first ones are equal, and so on. Adding or reordering a
rule means editing this list, the `RULES` sentences next to it, and the tests.

**Testing rules one by one.** Each test in `tests/domain/next-task.test.ts` builds tasks that tie
on the earlier rules and differ on exactly one, so that rule is the one deciding. A test where
several rules disagree would pass or fail without telling you which rule is wrong.

**Honest explanations.** The card only lists reasons that the rules use. A reason such as
"already started" sounded helpful but no rule looks at it, so showing it would have misled the
user about why the task was chosen.

---

## Chapter 7 — Tracing one user action end to end

**Action:** the user types "Review the main concepts", chooses the project and clicks **Add**.

1. **UI** — `QuickAddForm.submit()` (`src/ui/components/QuickAddForm.tsx`) calls
   `window.api.createTask({ title, projectId, dueDate })`.
2. **Preload** — `src/preload/preload.ts` forwards it: `ipcRenderer.invoke('tasks:create', input)`.
   The channel name comes from `CHANNELS` in `src/shared/api.ts`, so both sides spell it the same way.
3. **Main process** — `registerIpcHandlers` (`src/main/ipc.ts`) receives it and runs
   `toResult(() => useCases.createTask(input))`.
4. **Use case** — `createTask` (`src/application/use-cases.ts`) checks that the project exists,
   then validates each field (`validateTitle`, `validatePriority`, `validateOptionalDate`).
5. **Storage** — `store.insertTask(task)` runs a prepared `INSERT` in `src/data/sqlite-store.ts`.
   SQLite checks its own constraints.
6. **Result** — `toResult` returns `{ ok: true, value: task }`, or `{ ok: false, error }` with the
   validation message. A thrown error would lose its details across IPC (ADR-003).
7. **UI refresh** — on success the form calls `onCreated`, which is `App.reload()`: it asks for the
   whole dashboard again (`getDashboard`).
8. **Progress** — `getDashboard` groups tasks by project and calls `computeProgress` for each
   project and goal. The `Gauge` component draws the ratio and the counts.

**Design choice:** the UI always reloads what was saved instead of updating its own copy. It costs
one extra call, but the screen can never show something the database does not contain.

---

## Chapter 8 — Testing and debugging

### Strategy

| Level       | What it proves                                                         | Files                               | Command            |
| ----------- | ---------------------------------------------------------------------- | ----------------------------------- | ------------------ |
| Unit        | Pure rules: validation, transitions, progress                          | `tests/domain/`                     | `npm test`         |
| Integration | Use cases with a store; the real SQLite store, constraints, migrations | `tests/application/`, `tests/data/` | `npm test`         |
| End-to-end  | The packaged app: UI → IPC → use case → SQLite → UI, and a restart     | `tests/e2e/`                        | `npm run test:e2e` |

`npm run verify` runs type checking, lint, formatting check and the unit + integration tests.

**Contract tests.** The same `describe.each` block runs against the in-memory store and the SQLite
store. If the two ever behave differently, a test fails, so the fast in-memory tests stay trustworthy.

### A real failure during milestone 1

**Symptom.** The first run of the end-to-end test failed at the step that completes the task:

```
Error: locator.check: Clicking the checkbox did not change its state
```

Everything before that step had passed: the goal, project and task were created and the
dashboard showed "0 of 1 task done".

**Diagnosis.** The checkbox is a _controlled_ React input: `checked={task.status === 'done'}`.
Clicking it calls `toggle()`, which asks the main process to save the change and then reloads the
dashboard. Until that round trip completes, React keeps rendering the old value, so the box stays
unchecked for a moment. Playwright's `check()` verifies the state immediately after the click and
therefore saw no change.

**Is it a bug in the app?** No data was lost: the design deliberately shows only what was saved
(chapter 7). The test was checking the wrong thing: CA-1.2 is about the dashboard showing the
saved result, not about the checkbox changing instantly.

**Fix.** The test now clicks, waits for "1 of 1 task done", then asserts the checkbox is checked.
The assertion is not weaker: it still fails if the task is not saved or the dashboard is not updated.

**Possible improvement (not done).** An _optimistic update_ would tick the box immediately and
undo it if saving fails. It feels faster but adds a rollback path. Worth revisiting if the delay
becomes noticeable.

### Results recorded for milestone 1 (2026-10-25)

| Check                                                                   | Result                          |
| ----------------------------------------------------------------------- | ------------------------------- |
| `npm run verify` (typecheck, lint, format, 47 unit + integration tests) | Passed                          |
| `npm run test:e2e` (package + 1 end-to-end test including a restart)    | Passed after the test fix above |

### Two real events in milestone 2

**1. A test broke because the UI changed, not because the app did.** After adding buttons
labelled "Edit Review the main concepts", "Cancel Review the main concepts"…, the milestone 1
end-to-end test failed:

```
strict mode violation: getByLabel('Review the main concepts') resolved to 6 elements
```

`getByLabel` matches labels that _contain_ the text, so the checkbox and five new buttons all
matched. The fix targets the element by its **role**:
`getByRole('checkbox', { name: 'Review the main concepts' })`. Lesson: end-to-end tests should
select elements the way a user identifies them (a checkbox named X), not by a text fragment that
other controls may share.

**2. An independent code review found 10 issues after all tests passed.** A separate review
pass read the milestone 2 diff with fresh eyes. 9 of its 10 findings were fixed:

| Finding                                                                                       | Why the tests had not caught it                                       | Fix                                                      |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------- |
| Cancelling a parent also cancels its subtasks, in one click, and Reopen does not restore them | The behavior was intended and tested; the _risk for the user_ was not | Confirmation before cancelling a task with open subtasks |
| Errors appear at the top of the page, possibly off-screen                                     | Tests read the alert wherever it is                                   | The error banner sticks to the top of the window         |
| The test-only `DASHBOARD_USER_DATA` override also worked in the installed app                 | Tests only run the unpackaged app                                     | Ignored when `app.isPackaged`                            |
| A malformed request (`input` = null) crashed with a generic error                             | The UI always sends objects                                           | `requireObject(input)` in every create/update use case   |
| Nested transactions behaved differently in the two stores                                     | No code nests them yet                                                | Same rule in both stores + a contract test               |
| Loading all tasks to find one task's subtasks                                                 | Correct, just wasteful                                                | `Store.listSubtasks` using the index                     |
| Duplicated project-picker list; duplicated e2e helpers; an object copy used to test a status  | Not bugs                                                              | Shared helpers                                           |

The skipped finding (the preload's type cast) was kept on purpose: the channel names are still
checked by TypeScript, and the generic forwarding is what keeps the preload one screen long.

**Lesson:** passing tests prove the behavior that was specified. A reviewer asks a different
question — _what could go wrong for the user?_ — and finds risks the specification missed.

### Results recorded for milestone 2 (2026-10-25)

| Check                                                                       | Result                                                                  |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `npm run verify` (typecheck, lint, format, **89** unit + integration tests) | Passed                                                                  |
| `npm run test:e2e` (package + 2 end-to-end tests)                           | Passed after the selector fix above                                     |
| Confirmation dialog when cancelling a parent with open subtasks             | **Not covered by an automated test** (checked by reading the code only) |

### Results recorded for milestone 3 (2026-10-25)

| Check                                           | Result                                                             |
| ----------------------------------------------- | ------------------------------------------------------------------ |
| `npm run verify` (102 unit + integration tests) | Passed                                                             |
| `npm run test:e2e` (3 end-to-end tests)         | Passed                                                             |
| Reload after midnight                           | **Not covered by an automated test** (checked by reading the code) |

### Results recorded for milestone 4 (2026-10-25)

| Check                                           | Result |
| ----------------------------------------------- | ------ |
| `npm run verify` (116 unit + integration tests) | Passed |
| `npm run test:e2e` (4 end-to-end tests)         | Passed |

---

## Chapter 9 — Packaging and desktop integration (_planned, milestones 5–6_)

So far: `electron-forge package` builds the app (used by the end-to-end test). Not yet done:
the Windows installer, start at login, and their verification.

## Chapter 10 — GitHub and professional workflow (_planned, milestone 6_)

The repository is local with Git. Publication will happen only after explicit approval.

## Chapter 11 — Maintenance and future development (_planned_)

## Chapter 12 — What to learn next (_planned_)
