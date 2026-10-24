# ADR-003 — Module boundaries

- **Status:** Accepted (2026-10-25)

## Context

The app must grow (subtasks, recommendations, calendar later) without unrelated features
becoming tangled. Electron imposes two processes: the **main** process (Node.js: files,
database, OS) and the **renderer** (the UI, sandboxed like a web page).

## Decision

```
src/domain/       pure business rules: entities, validation, status transitions, progress
src/application/  use cases (one function per user action) + the Store interface
src/data/         Store implementations (SQLite, in-memory) and migrations
src/main/         Electron main process: window, database opening, IPC handlers
src/preload/      the bridge that exposes window.api to the UI
src/shared/       the IPC contract (types + channel names) used by both sides
src/ui/           React screens and components
```

Allowed dependencies: `ui → shared`, `preload → shared`, `main → application, data`,
`application → domain`, `data → application (Store type), domain`. **`domain` depends on nothing.**

## Where an abstraction is used, and where it is not

- **Used:** the `Store` interface. Use cases are tested with an in-memory store; the SQLite store
  is tested against the same contract. This is the one place where swapping implementations has
  a real benefit (tests, and the `better-sqlite3` fallback in ADR-002).
- **Not used:** no repository per entity, no service classes, no dependency-injection framework.
  Use cases are plain functions created by `createUseCases({ store, now, newId })`.

## Why errors cross IPC as values

`ipcRenderer.invoke` turns a thrown error into a generic message. Handlers return
`Result<T>` (`{ ok: true, value }` or `{ ok: false, error: { field, message } }`) so the UI can
show the exact validation message.

## Revisit if

The `application` layer grows large enough to need splitting by feature (e.g. `tasks/`, `goals/`).
