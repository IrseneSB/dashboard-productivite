// Database schema, expressed as an ordered list of migrations (ADR-002).
//
// Rules:
// - Never edit a migration that has already shipped: add a new one instead.
// - Each migration runs inside a transaction, so a failure leaves the
//   database exactly as it was before.
// - SQLite's built-in `user_version` pragma stores the number of the last
//   migration applied; no extra bookkeeping table is needed.

import type { DatabaseSync } from 'node:sqlite';

export interface Migration {
  version: number;
  description: string;
  sql: string;
}

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    description: 'goals, projects and tasks',
    sql: `
      CREATE TABLE goals (
        id                 TEXT PRIMARY KEY,
        title              TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
        description        TEXT NOT NULL DEFAULT '',
        success_definition TEXT NOT NULL DEFAULT '',
        target_date        TEXT CHECK (target_date IS NULL OR date(target_date) = target_date),
        status             TEXT NOT NULL CHECK (status IN ('active', 'achieved', 'archived')),
        created_at         TEXT NOT NULL,
        updated_at         TEXT NOT NULL
      );

      CREATE TABLE projects (
        id          TEXT PRIMARY KEY,
        -- A project supports at most one goal. Deleting a goal is not possible
        -- while projects still point to it (RESTRICT): goals are archived instead.
        goal_id     TEXT REFERENCES goals(id) ON DELETE RESTRICT,
        title       TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
        description TEXT NOT NULL DEFAULT '',
        target_date TEXT CHECK (target_date IS NULL OR date(target_date) = target_date),
        status      TEXT NOT NULL CHECK (status IN ('active', 'completed', 'archived')),
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );
      CREATE INDEX projects_goal_id ON projects(goal_id);

      CREATE TABLE tasks (
        id           TEXT PRIMARY KEY,
        -- NULL = the task is in the Inbox.
        project_id   TEXT REFERENCES projects(id) ON DELETE RESTRICT,
        title        TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
        notes        TEXT NOT NULL DEFAULT '',
        priority     TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
        due_date     TEXT CHECK (due_date IS NULL OR date(due_date) = due_date),
        status       TEXT NOT NULL CHECK (status IN ('todo', 'in_progress', 'blocked', 'done', 'cancelled')),
        -- A task has a completion time if and only if it is done.
        completed_at TEXT CHECK ((status = 'done') = (completed_at IS NOT NULL)),
        created_at   TEXT NOT NULL,
        updated_at   TEXT NOT NULL
      );
      CREATE INDEX tasks_project_id ON tasks(project_id);
    `,
  },
  {
    version: 2,
    description: 'subtasks (one level, see ADR-005)',
    // ADD COLUMN keeps every existing row; old tasks simply get NULL (top-level).
    // "One level only" and "same project as the parent" involve other rows, which
    // a CHECK constraint cannot see: the use cases enforce them.
    sql: `
      ALTER TABLE tasks ADD COLUMN parent_task_id TEXT
        REFERENCES tasks(id) ON DELETE RESTRICT
        CHECK (parent_task_id IS NULL OR parent_task_id <> id);
      CREATE INDEX tasks_parent_task_id ON tasks(parent_task_id);
    `,
  },
];

export function currentVersion(db: DatabaseSync): number {
  const row = db.prepare('PRAGMA user_version').get() as {
    user_version: number;
  };
  return row.user_version;
}

/** Applies every migration newer than the database. Returns the versions applied. */
export function migrate(
  db: DatabaseSync,
  migrations: readonly Migration[] = MIGRATIONS,
): number[] {
  const from = currentVersion(db);
  const latest = migrations.at(-1)?.version ?? 0;
  if (from > latest) {
    // The database was written by a newer version of the app. Refusing to
    // open it is safer than guessing how to read a schema we do not know.
    throw new Error(
      `Database schema version ${from} is newer than this app supports (${latest}). Update the app.`,
    );
  }
  const applied: number[] = [];
  for (const migration of migrations) {
    if (migration.version <= from) continue;
    db.exec('BEGIN');
    try {
      db.exec(migration.sql);
      db.exec(`PRAGMA user_version = ${migration.version}`);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw new Error(
        `Migration ${migration.version} (${migration.description}) failed`,
        {
          cause: error,
        },
      );
    }
    applied.push(migration.version);
  }
  return applied;
}
