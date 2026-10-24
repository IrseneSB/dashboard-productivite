# ADR-002 — Local persistence: SQLite through `node:sqlite`, in the main process

- **Status:** Accepted (2026-10-25)

## Context

The data is personal, used by one person on one computer, and must survive restarts. Goals,
projects and tasks are related to each other, and the rules (a task belongs to an existing
project, a done task has a completion time) must hold even if the code has a bug.

## Options considered

1. **JSON file** — simplest, but no constraints, no partial updates, risk of corruption if the
   app stops while writing.
2. **SQLite with `better-sqlite3`** — mature, but a native module that must be rebuilt for each
   Electron version.
3. **SQLite with Node's built-in `node:sqlite` (`DatabaseSync`)** — no native dependency to
   rebuild, synchronous API, same SQL.
4. **Remote database (Supabase, etc.)** — rejected: no need for sync or multiple users, adds
   accounts and network failure modes.

## Decision

Option 3. The database file lives in Electron's `userData` folder
(`%APPDATA%\Productivity Dashboard\dashboard.db`), never in the repository. Only the main
process opens it; the UI reaches it through IPC (see ADR-003).

## How integrity is protected

- `PRAGMA foreign_keys = ON` on every connection: no task can point to a missing project.
- `CHECK` constraints mirror the domain rules (valid statuses, real dates, `completed_at` set if
  and only if the task is done).
- `ON DELETE RESTRICT`: a goal with projects cannot be deleted; it is archived instead.
- `PRAGMA journal_mode = WAL`: a crash during a write cannot corrupt committed data.
- Prepared statements with bound parameters: user text is never interpreted as SQL.

## Schema changes

`src/data/migrations.ts` holds an ordered list of migrations. SQLite's `user_version` records
the last one applied. Each migration runs in a transaction; a failure rolls back. A database
written by a newer app version is refused rather than guessed at. Shipped migrations are never
edited.

## Consequences

- Tests can run the real SQLite store in plain Node.js (Node 24 includes `node:sqlite`).
- **Verified (2026-10-25):** Electron 45.0.0 bundles Node.js 24.22.0, and `node:sqlite` works
  inside it (SQLite 3.53.4). The end-to-end test runs the real app against a real database file.
  If a future Electron version dropped the module, the fallback is `better-sqlite3` behind the
  same `Store` interface.

## Revisit if

Sync across devices or sharing with other people becomes a requirement.
