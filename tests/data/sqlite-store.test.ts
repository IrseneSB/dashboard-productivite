import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Store } from '../../src/application/store';
import { createUseCases } from '../../src/application/use-cases';
import { createMemoryStore } from '../../src/data/memory-store';
import { currentVersion, migrate, MIGRATIONS } from '../../src/data/migrations';
import { createSqliteStore, openDatabase } from '../../src/data/sqlite-store';
import type { Goal, Project, Task } from '../../src/domain/model';

let dir: string;
const openDbs: DatabaseSync[] = [];

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'dashboard-test-'));
});

afterEach(() => {
  for (const db of openDbs.splice(0)) db.close();
  rmSync(dir, { recursive: true, force: true });
});

const open = (name = 'app.db') => {
  const db = openDatabase(join(dir, name));
  openDbs.push(db);
  return db;
};

const at = '2026-10-25T09:00:00.000Z';
const goal: Goal = {
  id: 'g1',
  title: 'Prepare for the semester',
  description: '',
  successDefinition: 'Pass every exam',
  targetDate: '2027-01-31',
  status: 'active',
  createdAt: at,
  updatedAt: at,
};
const project: Project = {
  id: 'p1',
  goalId: 'g1',
  title: 'Software Testing quiz',
  description: '',
  targetDate: null,
  status: 'active',
  createdAt: at,
  updatedAt: at,
};
const task: Task = {
  id: 't1',
  projectId: 'p1',
  parentTaskId: null,
  title: 'Review the main concepts',
  notes: '',
  priority: 'high',
  dueDate: '2026-10-30',
  status: 'todo',
  completedAt: null,
  createdAt: at,
  updatedAt: at,
};

// The same expectations run against both implementations, so the in-memory
// store used by the use-case tests cannot silently drift from the real one.
describe.each([
  ['memory', () => createMemoryStore()],
  ['sqlite', () => createSqliteStore(open())],
] as [string, () => Store][])('Store contract (%s)', (_name, makeStore) => {
  it('stores and reads back goals, projects and tasks unchanged', () => {
    const store = makeStore();
    store.insertGoal(goal);
    store.insertProject(project);
    store.insertTask(task);
    expect(store.getGoal('g1')).toEqual(goal);
    expect(store.getProject('p1')).toEqual(project);
    expect(store.getTask('t1')).toEqual(task);
    expect(store.listTasks()).toEqual([task]);
  });

  it('returns undefined for unknown ids', () => {
    const store = makeStore();
    expect(store.getGoal('nope')).toBeUndefined();
    expect(store.getTask('nope')).toBeUndefined();
  });

  it('updates a task', () => {
    const store = makeStore();
    store.insertGoal(goal);
    store.insertProject(project);
    store.insertTask(task);
    const done = { ...task, status: 'done' as const, completedAt: at };
    store.updateTask(done);
    expect(store.getTask('t1')).toEqual(done);
  });

  it('refuses to update a task that does not exist', () => {
    expect(() => makeStore().updateTask(task)).toThrow(/not found/);
  });
});

describe('SQLite persistence', () => {
  it('keeps data after the database is closed and reopened (CA-1.3)', () => {
    const path = join(dir, 'restart.db');
    const first = openDatabase(path);
    let n = 0;
    const app = createUseCases({
      store: createSqliteStore(first),
      now: () => new Date(at),
      newId: () => `id-${++n}`,
    });
    const g = app.createGoal({ title: 'Survives a restart' });
    const p = app.createProject({ goalId: g.id, title: 'Project' });
    const t = app.createTask({ projectId: p.id, title: 'Task' });
    app.setTaskStatus(t.id, 'done');
    first.close();

    const second = openDatabase(path);
    openDbs.push(second);
    const reopened = createUseCases({
      store: createSqliteStore(second),
      now: () => new Date(at),
      newId: () => 'unused',
    });
    const view = reopened.getDashboard().goals[0];
    expect(view.goal.title).toBe('Survives a restart');
    expect(view.progress).toEqual({ done: 1, total: 1, ratio: 1 });
  });
});

describe('database constraints protect data even if the app has a bug', () => {
  it('rejects a task pointing to a project that does not exist (foreign key)', () => {
    const store = createSqliteStore(open());
    expect(() => store.insertTask({ ...task, projectId: 'missing' })).toThrow(
      /FOREIGN KEY/,
    );
  });

  it('rejects an unknown status', () => {
    const store = createSqliteStore(open());
    expect(() =>
      store.insertTask({
        ...task,
        projectId: null,
        status: 'finished' as never,
      }),
    ).toThrow(/CHECK/);
  });

  it('rejects a done task without a completion time', () => {
    const store = createSqliteStore(open());
    expect(() =>
      store.insertTask({ ...task, projectId: null, status: 'done' }),
    ).toThrow(/CHECK/);
  });

  it('rejects an impossible date', () => {
    const store = createSqliteStore(open());
    expect(() =>
      store.insertTask({ ...task, projectId: null, dueDate: '2026-02-30' }),
    ).toThrow(/CHECK/);
  });

  it('refuses to delete a goal that still has projects', () => {
    const db = open();
    const store = createSqliteStore(db);
    store.insertGoal(goal);
    store.insertProject(project);
    expect(() => db.exec(`DELETE FROM goals WHERE id = 'g1'`)).toThrow(
      /FOREIGN KEY/,
    );
  });
});

describe('migrations', () => {
  it('brings a new database to the latest version', () => {
    expect(currentVersion(open())).toBe(MIGRATIONS.at(-1)!.version);
  });

  it('does nothing when the database is already up to date', () => {
    expect(migrate(open())).toEqual([]);
  });

  it('rolls back a failing migration and leaves the database unchanged', () => {
    const db = open();
    const broken = [
      ...MIGRATIONS,
      { version: 99, description: 'broken', sql: 'CREATE TABLE x (; ' },
    ];
    expect(() => migrate(db, broken)).toThrow(/Migration 99/);
    expect(currentVersion(db)).toBe(MIGRATIONS.at(-1)!.version);
  });

  it('refuses a database created by a newer version of the app', () => {
    const db = open();
    db.exec('PRAGMA user_version = 999');
    expect(() => migrate(db)).toThrow(/newer than this app supports/);
  });
});

describe.each([
  ['memory', () => createMemoryStore()],
  ['sqlite', () => createSqliteStore(open())],
] as [string, () => Store][])(
  'Store contract, milestone 2 (%s)',
  (_name, makeStore) => {
    it('updates goals and projects', () => {
      const store = makeStore();
      store.insertGoal(goal);
      store.insertProject(project);
      store.updateGoal({ ...goal, title: 'Renamed', status: 'archived' });
      store.updateProject({ ...project, goalId: null, status: 'completed' });
      expect(store.getGoal('g1')).toMatchObject({
        title: 'Renamed',
        status: 'archived',
      });
      expect(store.getProject('p1')).toMatchObject({
        goalId: null,
        status: 'completed',
      });
    });

    it('stores a subtask link', () => {
      const store = makeStore();
      store.insertGoal(goal);
      store.insertProject(project);
      store.insertTask(task);
      const sub = { ...task, id: 't2', parentTaskId: 't1' };
      store.insertTask(sub);
      expect(store.getTask('t2')).toEqual(sub);
    });

    it('undoes every write of a failed transaction (CA-2.8)', () => {
      const store = makeStore();
      store.insertGoal(goal);
      store.insertProject(project);
      store.insertTask(task);
      expect(() =>
        store.transaction(() => {
          store.updateTask({
            ...task,
            title: 'Changed inside the transaction',
          });
          throw new Error('simulated failure');
        }),
      ).toThrow('simulated failure');
      expect(store.getTask('t1')?.title).toBe(task.title);
    });

    it('keeps the writes of a successful transaction', () => {
      const store = makeStore();
      store.insertGoal(goal);
      store.insertProject(project);
      store.insertTask(task);
      store.transaction(() =>
        store.updateTask({ ...task, title: 'Committed' }),
      );
      expect(store.getTask('t1')?.title).toBe('Committed');
    });
  },
);

describe('migration 1 → 2 on an existing database (CA-2.9)', () => {
  it('adds subtasks without losing milestone 1 data', () => {
    const path = join(dir, 'v1.db');
    // Build a database exactly as milestone 1 left it: migration 1 only.
    const v1 = new DatabaseSync(path);
    v1.exec('PRAGMA foreign_keys = ON');
    migrate(v1, MIGRATIONS.slice(0, 1));
    v1.exec(
      `INSERT INTO goals VALUES ('g1', 'Old goal', '', '', NULL, 'active', '${at}', '${at}')`,
    );
    v1.exec(
      `INSERT INTO tasks (id, project_id, title, notes, priority, due_date, status, completed_at, created_at, updated_at)
       VALUES ('t1', NULL, 'Old task', '', 'medium', NULL, 'todo', NULL, '${at}', '${at}')`,
    );
    expect(currentVersion(v1)).toBe(1);
    v1.close();

    const upgraded = openDatabase(path);
    openDbs.push(upgraded);
    expect(currentVersion(upgraded)).toBe(2);
    const store = createSqliteStore(upgraded);
    expect(store.getGoal('g1')?.title).toBe('Old goal');
    expect(store.getTask('t1')).toMatchObject({
      title: 'Old task',
      parentTaskId: null,
    });
  });

  it('refuses a task that is its own parent', () => {
    const store = createSqliteStore(open());
    expect(() =>
      store.insertTask({ ...task, projectId: null, parentTaskId: 't1' }),
    ).toThrow(/CHECK|FOREIGN KEY/);
  });
});

describe.each([
  ['memory', () => createMemoryStore()],
  ['sqlite', () => createSqliteStore(open())],
] as [string, () => Store][])(
  'Store contract, code review fixes (%s)',
  (_name, makeStore) => {
    it('lists only the direct subtasks of a task', () => {
      const store = makeStore();
      store.insertGoal(goal);
      store.insertProject(project);
      store.insertTask(task);
      store.insertTask({ ...task, id: 't2', parentTaskId: 't1' });
      store.insertTask({ ...task, id: 't3', parentTaskId: null });
      expect(store.listSubtasks('t1').map((t) => t.id)).toEqual(['t2']);
      expect(store.listSubtasks('t3')).toEqual([]);
    });

    it('lets the outer transaction decide when transactions are nested', () => {
      const store = makeStore();
      store.insertGoal(goal);
      store.insertProject(project);
      store.insertTask(task);
      store.transaction(() => {
        try {
          store.transaction(() => {
            store.updateTask({ ...task, title: 'Inner write' });
            throw new Error('inner failure');
          });
        } catch {
          // The caller chooses to continue; the outer transaction commits.
        }
      });
      // Both stores now agree: the inner write was kept by the outer commit.
      expect(store.getTask('t1')?.title).toBe('Inner write');
    });
  },
);
