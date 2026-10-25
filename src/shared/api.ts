// The contract between the renderer (UI) and the main process.
//
// Electron runs the UI in a separate, sandboxed process that cannot open the
// database. The UI calls these functions; the preload script forwards each call
// over IPC (inter-process communication) to the main process, which runs the
// use case and sends the result back.

import type {
  CreateGoalInput,
  CreateProjectInput,
  CreateTaskInput,
  DashboardView,
  UpdateGoalInput,
  UpdateProjectInput,
  UpdateTaskInput,
} from '../application/use-cases';
import type { Goal, Id, Project, Task } from '../domain/model';

/**
 * Errors are returned as values instead of thrown: Electron turns a thrown
 * error into a generic "Error invoking remote method" message, which would
 * lose the field name the UI needs to highlight the wrong input.
 */
export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: { field: string | null; message: string } };

export interface DashboardApi {
  getDashboard(): Promise<Result<DashboardView>>;

  createGoal(input: CreateGoalInput): Promise<Result<Goal>>;
  updateGoal(id: Id, input: UpdateGoalInput): Promise<Result<Goal>>;
  setGoalStatus(id: Id, status: string): Promise<Result<Goal>>;

  createProject(input: CreateProjectInput): Promise<Result<Project>>;
  updateProject(id: Id, input: UpdateProjectInput): Promise<Result<Project>>;
  setProjectStatus(id: Id, status: string): Promise<Result<Project>>;

  createTask(input: CreateTaskInput): Promise<Result<Task>>;
  updateTask(id: Id, input: UpdateTaskInput): Promise<Result<Task>>;
  setTaskStatus(taskId: Id, status: string): Promise<Result<Task>>;
  postponeTask(taskId: Id, days: number): Promise<Result<Task>>;
}

/** IPC channel names, shared so the two sides cannot disagree on a spelling. */
export const CHANNELS = {
  getDashboard: 'dashboard:get',
  createGoal: 'goals:create',
  updateGoal: 'goals:update',
  setGoalStatus: 'goals:setStatus',
  createProject: 'projects:create',
  updateProject: 'projects:update',
  setProjectStatus: 'projects:setStatus',
  createTask: 'tasks:create',
  updateTask: 'tasks:update',
  setTaskStatus: 'tasks:setStatus',
  postponeTask: 'tasks:postpone',
} as const satisfies Record<keyof DashboardApi, string>;
