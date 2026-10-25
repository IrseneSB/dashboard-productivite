// SQLite implementation of the Store, using Node's built-in node:sqlite module
// (ADR-002). It runs in Electron's main process only: the renderer never
// touches the database directly.

import { DatabaseSync } from 'node:sqlite';
import type { Store } from '../application/store';
import type { Goal, Project, Task } from '../domain/model';
import { migrate } from './migrations';

/** Opens (or creates) the database file, enables integrity checks and migrates it. */
export function openDatabase(path: string): DatabaseSync {
  const db = new DatabaseSync(path);
  // SQLite does not enforce foreign keys unless asked, per connection.
  db.exec('PRAGMA foreign_keys = ON');
  // Write-ahead logging: a crash during a write cannot corrupt committed data.
  db.exec('PRAGMA journal_mode = WAL');
  migrate(db);
  return db;
}

// Rows use snake_case column names; the domain uses camelCase. These small
// mapping functions are the only place where the two meet.
type Row = Record<string, string | null>;

const toGoal = (r: Row): Goal => ({
  id: r.id!,
  title: r.title!,
  description: r.description!,
  successDefinition: r.success_definition!,
  targetDate: r.target_date,
  status: r.status as Goal['status'],
  createdAt: r.created_at!,
  updatedAt: r.updated_at!,
});

const toProject = (r: Row): Project => ({
  id: r.id!,
  goalId: r.goal_id,
  title: r.title!,
  description: r.description!,
  targetDate: r.target_date,
  status: r.status as Project['status'],
  createdAt: r.created_at!,
  updatedAt: r.updated_at!,
});

const toTask = (r: Row): Task => ({
  id: r.id!,
  projectId: r.project_id,
  parentTaskId: r.parent_task_id,
  title: r.title!,
  notes: r.notes!,
  priority: r.priority as Task['priority'],
  dueDate: r.due_date,
  status: r.status as Task['status'],
  completedAt: r.completed_at,
  createdAt: r.created_at!,
  updatedAt: r.updated_at!,
});

export function createSqliteStore(db: DatabaseSync): Store {
  // Prepared once, reused for every call. Named parameters (:id) are bound by
  // SQLite itself, so user text can never be interpreted as SQL.
  const q = {
    insertGoal: db.prepare(
      `INSERT INTO goals (id, title, description, success_definition, target_date, status, created_at, updated_at)
       VALUES (:id, :title, :description, :successDefinition, :targetDate, :status, :createdAt, :updatedAt)`,
    ),
    updateGoal: db.prepare(
      `UPDATE goals SET title = :title, description = :description, success_definition = :successDefinition,
         target_date = :targetDate, status = :status, updated_at = :updatedAt
       WHERE id = :id`,
    ),
    getGoal: db.prepare('SELECT * FROM goals WHERE id = ?'),
    listGoals: db.prepare('SELECT * FROM goals ORDER BY created_at, id'),

    insertProject: db.prepare(
      `INSERT INTO projects (id, goal_id, title, description, target_date, status, created_at, updated_at)
       VALUES (:id, :goalId, :title, :description, :targetDate, :status, :createdAt, :updatedAt)`,
    ),
    updateProject: db.prepare(
      `UPDATE projects SET goal_id = :goalId, title = :title, description = :description,
         target_date = :targetDate, status = :status, updated_at = :updatedAt
       WHERE id = :id`,
    ),
    getProject: db.prepare('SELECT * FROM projects WHERE id = ?'),
    listProjects: db.prepare('SELECT * FROM projects ORDER BY created_at, id'),

    insertTask: db.prepare(
      `INSERT INTO tasks (id, project_id, parent_task_id, title, notes, priority, due_date, status, completed_at, created_at, updated_at)
       VALUES (:id, :projectId, :parentTaskId, :title, :notes, :priority, :dueDate, :status, :completedAt, :createdAt, :updatedAt)`,
    ),
    updateTask: db.prepare(
      `UPDATE tasks SET project_id = :projectId, parent_task_id = :parentTaskId, title = :title, notes = :notes, priority = :priority,
         due_date = :dueDate, status = :status, completed_at = :completedAt, updated_at = :updatedAt
       WHERE id = :id`,
    ),
    getTask: db.prepare('SELECT * FROM tasks WHERE id = ?'),
    listTasks: db.prepare('SELECT * FROM tasks ORDER BY created_at, id'),
    // Uses the tasks_parent_task_id index: reads only the children.
    listSubtasks: db.prepare(
      'SELECT * FROM tasks WHERE parent_task_id = ? ORDER BY created_at, id',
    ),
  };

  const one = <T>(row: unknown, map: (r: Row) => T): T | undefined =>
    row === undefined ? undefined : map(row as Row);
  const all = <T>(rows: unknown[], map: (r: Row) => T): T[] =>
    rows.map((r) => map(r as Row));

  const expectOneRow = (changes: number | bigint, kind: string, id: string) => {
    if (Number(changes) !== 1) throw new Error(`${kind} ${id} not found`);
  };

  return {
    insertGoal: (goal) => void q.insertGoal.run({ ...goal }),
    updateGoal: (goal) => {
      const { createdAt: _createdAt, ...fields } = goal;
      expectOneRow(q.updateGoal.run(fields).changes, 'Goal', goal.id);
    },
    getGoal: (id) => one(q.getGoal.get(id), toGoal),
    listGoals: () => all(q.listGoals.all(), toGoal),

    insertProject: (project) => void q.insertProject.run({ ...project }),
    updateProject: (project) => {
      const { createdAt: _createdAt, ...fields } = project;
      expectOneRow(q.updateProject.run(fields).changes, 'Project', project.id);
    },
    getProject: (id) => one(q.getProject.get(id), toProject),
    listProjects: () => all(q.listProjects.all(), toProject),

    insertTask: (task) => void q.insertTask.run({ ...task }),
    updateTask: (task) => {
      const result = q.updateTask.run({
        id: task.id,
        projectId: task.projectId,
        parentTaskId: task.parentTaskId,
        title: task.title,
        notes: task.notes,
        priority: task.priority,
        dueDate: task.dueDate,
        status: task.status,
        completedAt: task.completedAt,
        updatedAt: task.updatedAt,
      });
      expectOneRow(result.changes, 'Task', task.id);
    },
    getTask: (id) => one(q.getTask.get(id), toTask),
    listTasks: () => all(q.listTasks.all(), toTask),
    listSubtasks: (parentTaskId) =>
      all(q.listSubtasks.all(parentTaskId), toTask),

    transaction: (work) => {
      // Already inside a transaction: the outer one decides commit or rollback.
      if (db.isTransaction) return work();
      db.exec('BEGIN');
      try {
        const result = work();
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
}
