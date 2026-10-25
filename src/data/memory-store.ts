// In-memory Store used by the use-case tests. It follows the same contract as
// SqliteStore, so a test that passes here checks the business workflow
// without any database involved.

import type { Store } from '../application/store';
import type { Goal, Id, Project, Task } from '../domain/model';

export function createMemoryStore(): Store {
  let goals = new Map<Id, Goal>();
  let projects = new Map<Id, Project>();
  let tasks = new Map<Id, Task>();
  let inTransaction = false;
  let settings = new Map<string, string>();
  // Copies prevent a caller from mutating stored data by accident,
  // which a real database would never allow either.
  const copy = <T>(value: T | undefined): T | undefined =>
    value === undefined ? undefined : { ...value };
  const update = <T extends { id: Id }>(
    map: Map<Id, T>,
    row: T,
    kind: string,
  ) => {
    if (!map.has(row.id)) throw new Error(`${kind} ${row.id} not found`);
    map.set(row.id, { ...row });
  };

  return {
    insertGoal: (goal) => void goals.set(goal.id, { ...goal }),
    updateGoal: (goal) => update(goals, goal, 'Goal'),
    getGoal: (id) => copy(goals.get(id)),
    listGoals: () => [...goals.values()].map((g) => ({ ...g })),

    insertProject: (project) => void projects.set(project.id, { ...project }),
    updateProject: (project) => update(projects, project, 'Project'),
    getProject: (id) => copy(projects.get(id)),
    listProjects: () => [...projects.values()].map((p) => ({ ...p })),

    insertTask: (task) => void tasks.set(task.id, { ...task }),
    updateTask: (task) => update(tasks, task, 'Task'),
    getTask: (id) => copy(tasks.get(id)),
    listTasks: () => [...tasks.values()].map((t) => ({ ...t })),
    getSetting: (key) => settings.get(key),
    setSetting: (key, value) => void settings.set(key, value),
    listSubtasks: (parentTaskId) =>
      [...tasks.values()]
        .filter((t) => t.parentTaskId === parentTaskId)
        .map((t) => ({ ...t })),

    transaction: (work) => {
      // Nested call: like SqliteStore, let the outermost transaction decide.
      if (inTransaction) return work();
      // Snapshot, run, and restore the snapshot if anything fails.
      inTransaction = true;
      const saved = [
        new Map(goals),
        new Map(projects),
        new Map(tasks),
        new Map(settings),
      ] as const;
      try {
        return work();
      } catch (error) {
        [goals, projects, tasks, settings] = saved;
        throw error;
      } finally {
        inTransaction = false;
      }
    },
  };
}
