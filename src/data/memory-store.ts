// In-memory Store used by the use-case tests. It follows the same contract as
// SqliteStore, so a test that passes here checks the business workflow
// without any database involved.

import type { Store } from '../application/store';
import type { Goal, Id, Project, Task } from '../domain/model';

export function createMemoryStore(): Store {
  const goals = new Map<Id, Goal>();
  const projects = new Map<Id, Project>();
  const tasks = new Map<Id, Task>();
  // Copies prevent a caller from mutating stored data by accident,
  // which a real database would never allow either.
  const copy = <T>(value: T | undefined): T | undefined =>
    value === undefined ? undefined : { ...value };

  return {
    insertGoal: (goal) => void goals.set(goal.id, { ...goal }),
    getGoal: (id) => copy(goals.get(id)),
    listGoals: () => [...goals.values()].map((g) => ({ ...g })),

    insertProject: (project) => void projects.set(project.id, { ...project }),
    getProject: (id) => copy(projects.get(id)),
    listProjects: () => [...projects.values()].map((p) => ({ ...p })),

    insertTask: (task) => void tasks.set(task.id, { ...task }),
    updateTask: (task) => {
      if (!tasks.has(task.id)) throw new Error(`Task ${task.id} not found`);
      tasks.set(task.id, { ...task });
    },
    getTask: (id) => copy(tasks.get(id)),
    listTasks: () => [...tasks.values()].map((t) => ({ ...t })),
  };
}
