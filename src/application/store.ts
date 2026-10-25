// The persistence contract used by the use cases.
//
// This is the one abstraction the architecture deliberately keeps (ADR-003):
// use cases depend on this interface, not on SQLite, so the business workflow
// can be tested with the in-memory store and the real SQLite store can be
// tested separately against the same expectations.
//
// Methods are synchronous because node:sqlite's DatabaseSync is synchronous
// and fast for a local, single-user database.

import type { Goal, Id, Project, Task } from '../domain/model';

export interface Store {
  insertGoal(goal: Goal): void;
  updateGoal(goal: Goal): void;
  getGoal(id: Id): Goal | undefined;
  listGoals(): Goal[];

  insertProject(project: Project): void;
  updateProject(project: Project): void;
  getProject(id: Id): Project | undefined;
  listProjects(): Project[];

  insertTask(task: Task): void;
  updateTask(task: Task): void;
  getTask(id: Id): Task | undefined;
  listTasks(): Task[];
  /** Direct subtasks of a task, oldest first. */
  listSubtasks(parentTaskId: Id): Task[];

  /**
   * Runs `work` as one unit: if it throws, every write it made is undone.
   * Used when one user action changes several rows (moving a task and its
   * subtasks), so the data is never left half-updated.
   */
  transaction<T>(work: () => T): T;
}
