# Engineering learning guide

How this application was built, decision by decision. It describes the **actual** code in this
repository and is updated at every milestone.

**State of this guide:** written at the end of **milestone 1** (vertical slice). Chapters marked
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
  domain/          model.ts, validation.ts, task-status.ts, progress.ts
  application/     store.ts (interface), use-cases.ts
  data/            migrations.ts, sqlite-store.ts, memory-store.ts
  main/            main.ts (entry point), ipc.ts
  preload/         preload.ts
  shared/          api.ts (IPC contract)
  ui/              main.tsx (entry), App.tsx, components/, styles.css, window.d.ts
tests/
  domain/          pure rules
  application/     use cases with the in-memory store
  data/            the real SQLite store, constraints, migrations
  e2e/             the packaged app driven by Playwright
docs/
  requirements.md, learning-guide.md, journal.md, process-evaluation.md
  decisions/       ADR-001 … ADR-004
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

---

## Chapter 9 — Packaging and desktop integration (_planned, milestones 5–6_)

So far: `electron-forge package` builds the app (used by the end-to-end test). Not yet done:
the Windows installer, start at login, and their verification.

## Chapter 10 — GitHub and professional workflow (_planned, milestone 6_)

The repository is local with Git. Publication will happen only after explicit approval.

## Chapter 11 — Maintenance and future development (_planned_)

## Chapter 12 — What to learn next (_planned_)
