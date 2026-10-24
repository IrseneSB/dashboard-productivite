// Domain model: the entities of the application and their allowed values.
// This module has no dependencies, so it can be used by every other layer
// (main process, renderer, tests) without pulling in Electron or SQLite.

export type Id = string;

/** Calendar date without time, formatted as YYYY-MM-DD. */
export type IsoDate = string;

/** Point in time, formatted as an ISO 8601 string (Date.toISOString()). */
export type IsoDateTime = string;

export const GOAL_STATUSES = ['active', 'achieved', 'archived'] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export const PROJECT_STATUSES = ['active', 'completed', 'archived'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const TASK_STATUSES = [
  'todo',
  'in_progress',
  'blocked',
  'done',
  'cancelled',
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const PRIORITIES = ['low', 'medium', 'high'] as const;
export type Priority = (typeof PRIORITIES)[number];

/** A long-term objective, e.g. "Become a stronger backend developer". */
export interface Goal {
  id: Id;
  title: string;
  description: string;
  successDefinition: string;
  targetDate: IsoDate | null;
  status: GoalStatus;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

/** A short-term objective or project that supports at most one goal. */
export interface Project {
  id: Id;
  /** null = a standalone project that does not support any goal yet. */
  goalId: Id | null;
  title: string;
  description: string;
  targetDate: IsoDate | null;
  status: ProjectStatus;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

/** An actionable piece of work. */
export interface Task {
  id: Id;
  /** null = the task sits in the Inbox, outside any project. */
  projectId: Id | null;
  title: string;
  notes: string;
  priority: Priority;
  dueDate: IsoDate | null;
  status: TaskStatus;
  completedAt: IsoDateTime | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}
