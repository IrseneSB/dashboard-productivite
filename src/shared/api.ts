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

  // Milestone 5: settings and export.
  getStartupState(): Promise<Result<StartupState>>;
  setStartAtLogin(enabled: boolean): Promise<Result<StartupState>>;
  getStartupQuestion(): Promise<Result<{ pending: boolean }>>;
  answerStartupQuestion(): Promise<Result<{ pending: boolean }>>;
  exportToFile(): Promise<Result<ExportResult>>;
}

/** Start at Windows login, as Windows reports it (see src/main/startup.ts). */
export interface StartupState {
  /** false in development: a dev build must never register itself at login. */
  available: boolean;
  enabled: boolean;
  /** Why the switch is disabled, shown to the user. */
  reason: string | null;
}

export interface ExportResult {
  /** false when the user cancelled the save dialog. */
  saved: boolean;
  path: string | null;
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
  getStartupState: 'settings:getStartup',
  setStartAtLogin: 'settings:setStartAtLogin',
  getStartupQuestion: 'settings:getStartupQuestion',
  answerStartupQuestion: 'settings:answerStartupQuestion',
  exportToFile: 'data:exportToFile',
} as const satisfies Record<keyof DashboardApi, string>;
