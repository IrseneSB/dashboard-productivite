// Use cases: one function per user action. Each one validates its input,
// applies the domain rules and saves the result through the Store.
// They know nothing about Electron, IPC or React.

import { localIsoDate, postponedDueDate } from '../domain/dates';
import type {
  Goal,
  GoalStatus,
  Id,
  Project,
  ProjectStatus,
  Task,
  TaskStatus,
} from '../domain/model';
import {
  GOAL_STATUSES,
  PROJECT_STATUSES,
  TASK_STATUSES,
} from '../domain/model';
import { computeProgress, type Progress } from '../domain/progress';
import { transitionTask } from '../domain/task-status';
import {
  ValidationError,
  requireObject,
  validateOptionalDate,
  validatePriority,
  validateText,
  validateTitle,
} from '../domain/validation';
import type { Store } from './store';

export interface Dependencies {
  store: Store;
  /** Injected so tests can control time. */
  now: () => Date;
  /** Injected so tests can produce predictable ids. */
  newId: () => Id;
}

export interface CreateGoalInput {
  title: string;
  description?: string;
  successDefinition?: string;
  targetDate?: string | null;
}

/** Fields left undefined are not changed. `null` clears an optional date. */
export type UpdateGoalInput = Partial<CreateGoalInput>;

export interface CreateProjectInput {
  goalId?: Id | null;
  title: string;
  description?: string;
  targetDate?: string | null;
}

export type UpdateProjectInput = Partial<CreateProjectInput>;

export interface CreateTaskInput {
  projectId?: Id | null;
  /** Set to create a subtask; the subtask takes its parent's project. */
  parentTaskId?: Id | null;
  title: string;
  notes?: string;
  priority?: string;
  dueDate?: string | null;
}

export type UpdateTaskInput = Partial<
  Pick<
    CreateTaskInput,
    'projectId' | 'title' | 'notes' | 'priority' | 'dueDate'
  >
>;

export interface TaskView {
  task: Task;
  subtasks: Task[];
  /** null when the task has no subtasks. */
  subtaskProgress: Progress | null;
}

export interface ProjectView {
  project: Project;
  /** Counts top-level tasks only (ADR-005). */
  progress: Progress;
  tasks: TaskView[];
}

export interface GoalView {
  goal: Goal;
  progress: Progress;
  projects: ProjectView[];
}

export interface DashboardView {
  goals: GoalView[];
  /** Projects that do not support any goal. */
  standaloneProjects: ProjectView[];
  /** Top-level tasks outside any project, with their subtasks. */
  inbox: TaskView[];
  /** Archived items, listed so they can be restored. */
  archived: { goals: Goal[]; projects: Project[] };
}

/** Open = work still to do. Done and cancelled tasks are closed. */
const isOpenStatus = (status: TaskStatus) =>
  status !== 'done' && status !== 'cancelled';
const isOpen = (task: Task) => isOpenStatus(task.status);

export function createUseCases({ store, now, newId }: Dependencies) {
  const timestamp = () => now().toISOString();

  // ---- lookups that turn "not found" and "archived" into user-facing errors

  function requireGoal(id: Id): Goal {
    const goal = store.getGoal(id);
    if (!goal)
      throw new ValidationError('goalId', 'The selected goal does not exist.');
    return goal;
  }

  function requireProject(id: Id): Project {
    const project = store.getProject(id);
    if (!project) {
      throw new ValidationError(
        'projectId',
        'The selected project does not exist.',
      );
    }
    return project;
  }

  function requireTask(id: Id): Task {
    const task = store.getTask(id);
    if (!task)
      throw new ValidationError('taskId', 'This task no longer exists.');
    return task;
  }

  /** New work cannot be added under something that was set aside (CA-2.3). */
  function requireOpenGoal(id: Id): Goal {
    const goal = requireGoal(id);
    if (goal.status === 'archived') {
      throw new ValidationError(
        'goalId',
        'This goal is archived. Restore it first.',
      );
    }
    return goal;
  }

  function requireOpenProject(id: Id): Project {
    const project = requireProject(id);
    if (project.status === 'archived') {
      throw new ValidationError(
        'projectId',
        'This project is archived. Restore it first.',
      );
    }
    if (project.goalId !== null) requireOpenGoal(project.goalId);
    return project;
  }

  const subtasksOf = (taskId: Id): Task[] => store.listSubtasks(taskId);

  // ---- goals

  function createGoal(input: CreateGoalInput): Goal {
    requireObject(input);
    const at = timestamp();
    const goal: Goal = {
      id: newId(),
      title: validateTitle(input.title),
      description: validateText(input.description, 'description'),
      successDefinition: validateText(
        input.successDefinition,
        'successDefinition',
      ),
      targetDate: validateOptionalDate(input.targetDate, 'targetDate'),
      status: 'active',
      createdAt: at,
      updatedAt: at,
    };
    store.insertGoal(goal);
    return goal;
  }

  function updateGoal(id: Id, input: UpdateGoalInput): Goal {
    requireObject(input);
    const goal = requireGoal(id);
    // Every field is validated before anything is saved (CA-2.1).
    const updated: Goal = {
      ...goal,
      title:
        input.title === undefined ? goal.title : validateTitle(input.title),
      description:
        input.description === undefined
          ? goal.description
          : validateText(input.description, 'description'),
      successDefinition:
        input.successDefinition === undefined
          ? goal.successDefinition
          : validateText(input.successDefinition, 'successDefinition'),
      targetDate:
        input.targetDate === undefined
          ? goal.targetDate
          : validateOptionalDate(input.targetDate, 'targetDate'),
      updatedAt: timestamp(),
    };
    store.updateGoal(updated);
    return updated;
  }

  /** active ⇄ achieved ⇄ archived; archiving hides the goal and its projects (CA-2.2). */
  function setGoalStatus(id: Id, status: string): Goal {
    if (!(GOAL_STATUSES as readonly string[]).includes(status)) {
      throw new ValidationError('status', `Unknown goal status "${status}".`);
    }
    const goal = requireGoal(id);
    const updated: Goal = {
      ...goal,
      status: status as GoalStatus,
      updatedAt: timestamp(),
    };
    store.updateGoal(updated);
    return updated;
  }

  // ---- projects

  function createProject(input: CreateProjectInput): Project {
    requireObject(input);
    const goalId = input.goalId ?? null;
    if (goalId !== null) requireOpenGoal(goalId);
    const at = timestamp();
    const project: Project = {
      id: newId(),
      goalId,
      title: validateTitle(input.title),
      description: validateText(input.description, 'description'),
      targetDate: validateOptionalDate(input.targetDate, 'targetDate'),
      status: 'active',
      createdAt: at,
      updatedAt: at,
    };
    store.insertProject(project);
    return project;
  }

  function updateProject(id: Id, input: UpdateProjectInput): Project {
    requireObject(input);
    const project = requireProject(id);
    let goalId = project.goalId;
    if (input.goalId !== undefined && input.goalId !== project.goalId) {
      goalId = input.goalId;
      if (goalId !== null) requireOpenGoal(goalId);
    }
    const updated: Project = {
      ...project,
      goalId,
      title:
        input.title === undefined ? project.title : validateTitle(input.title),
      description:
        input.description === undefined
          ? project.description
          : validateText(input.description, 'description'),
      targetDate:
        input.targetDate === undefined
          ? project.targetDate
          : validateOptionalDate(input.targetDate, 'targetDate'),
      updatedAt: timestamp(),
    };
    store.updateProject(updated);
    return updated;
  }

  function setProjectStatus(id: Id, status: string): Project {
    if (!(PROJECT_STATUSES as readonly string[]).includes(status)) {
      throw new ValidationError(
        'status',
        `Unknown project status "${status}".`,
      );
    }
    const project = requireProject(id);
    if (status !== 'archived' && project.goalId !== null) {
      // Restoring a project under an archived goal would leave it invisible.
      const goal = requireGoal(project.goalId);
      if (goal.status === 'archived') {
        throw new ValidationError(
          'status',
          'Its goal is archived. Restore the goal first.',
        );
      }
    }
    const updated: Project = {
      ...project,
      status: status as ProjectStatus,
      updatedAt: timestamp(),
    };
    store.updateProject(updated);
    return updated;
  }

  // ---- tasks

  function createTask(input: CreateTaskInput): Task {
    requireObject(input);
    const parentTaskId = input.parentTaskId ?? null;
    let projectId = input.projectId ?? null;

    if (parentTaskId !== null) {
      const parent = requireTask(parentTaskId);
      if (parent.parentTaskId !== null) {
        throw new ValidationError(
          'parentTaskId',
          'A subtask cannot have its own subtasks.',
        );
      }
      if (!isOpen(parent)) {
        throw new ValidationError(
          'parentTaskId',
          `The parent task is ${parent.status}. Reopen it before adding subtasks.`,
        );
      }
      if (
        input.projectId !== undefined &&
        input.projectId !== parent.projectId
      ) {
        throw new ValidationError(
          'projectId',
          "A subtask always belongs to its parent's project.",
        );
      }
      projectId = parent.projectId;
    }
    if (projectId !== null) requireOpenProject(projectId);

    const at = timestamp();
    const task: Task = {
      id: newId(),
      projectId,
      parentTaskId,
      title: validateTitle(input.title),
      notes: validateText(input.notes, 'notes'),
      priority: validatePriority(input.priority),
      dueDate: validateOptionalDate(input.dueDate, 'dueDate'),
      status: 'todo',
      completedAt: null,
      createdAt: at,
      updatedAt: at,
    };
    store.insertTask(task);
    return task;
  }

  function updateTask(id: Id, input: UpdateTaskInput): Task {
    requireObject(input);
    const task = requireTask(id);
    const at = timestamp();
    const updated: Task = {
      ...task,
      title:
        input.title === undefined ? task.title : validateTitle(input.title),
      notes:
        input.notes === undefined
          ? task.notes
          : validateText(input.notes, 'notes'),
      priority:
        input.priority === undefined
          ? task.priority
          : validatePriority(input.priority),
      dueDate:
        input.dueDate === undefined
          ? task.dueDate
          : validateOptionalDate(input.dueDate, 'dueDate'),
      updatedAt: at,
    };

    const moving =
      input.projectId !== undefined && input.projectId !== task.projectId;
    if (!moving) {
      store.updateTask(updated);
      return updated;
    }
    if (task.parentTaskId !== null) {
      throw new ValidationError(
        'projectId',
        "A subtask always belongs to its parent's project.",
      );
    }
    const projectId = input.projectId ?? null;
    if (projectId !== null) requireOpenProject(projectId);

    // The task and its subtasks move together, or not at all (CA-2.8).
    return store.transaction(() => {
      const moved = { ...updated, projectId };
      store.updateTask(moved);
      for (const subtask of subtasksOf(task.id)) {
        store.updateTask({ ...subtask, projectId, updatedAt: at });
      }
      return moved;
    });
  }

  function setTaskStatus(taskId: Id, status: string): Task {
    if (!(TASK_STATUSES as readonly string[]).includes(status)) {
      throw new ValidationError('status', `Unknown status "${status}".`);
    }
    const to = status as TaskStatus;
    const task = requireTask(taskId);
    const at = timestamp();

    if (task.parentTaskId === null) {
      const openSubtasks = subtasksOf(task.id).filter(isOpen);
      if (to === 'done' && openSubtasks.length > 0) {
        // Assumption A7: "done" must not hide unfinished work.
        const n = openSubtasks.length;
        throw new ValidationError(
          'status',
          `Finish or cancel its ${n} open subtask${n > 1 ? 's' : ''} first.`,
        );
      }
      if (to === 'cancelled' && openSubtasks.length > 0) {
        // Cancelling a task cancels the work it is made of.
        return store.transaction(() => {
          const cancelled = transitionTask(task, 'cancelled', at);
          store.updateTask(cancelled);
          for (const subtask of openSubtasks) {
            store.updateTask(transitionTask(subtask, 'cancelled', at));
          }
          return cancelled;
        });
      }
    } else if (isOpenStatus(to)) {
      const parent = requireTask(task.parentTaskId);
      if (!isOpen(parent)) {
        throw new ValidationError(
          'status',
          `The parent task is ${parent.status}. Reopen it before reopening this subtask.`,
        );
      }
    }

    const updated = transitionTask(task, to, at);
    if (updated !== task) store.updateTask(updated);
    return updated;
  }

  /** Moves the due date by `days` (A9). */
  function postponeTask(taskId: Id, days: number): Task {
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      throw new ValidationError('days', 'Postpone by 1 to 365 days.');
    }
    const task = requireTask(taskId);
    if (!isOpen(task)) {
      throw new ValidationError(
        'status',
        `A ${task.status} task cannot be postponed.`,
      );
    }
    const updated: Task = {
      ...task,
      dueDate: postponedDueDate(task.dueDate, days, localIsoDate(now())),
      updatedAt: timestamp(),
    };
    store.updateTask(updated);
    return updated;
  }

  // ---- dashboard

  function getDashboard(): DashboardView {
    const tasks = store.listTasks();
    const subtasksByParent = new Map<Id, Task[]>();
    const topLevelByProject = new Map<Id | null, Task[]>();
    for (const task of tasks) {
      const map =
        task.parentTaskId === null ? topLevelByProject : subtasksByParent;
      const key = task.parentTaskId ?? task.projectId;
      const list = map.get(key) ?? [];
      list.push(task);
      map.set(key, list);
    }

    const toTaskView = (task: Task): TaskView => {
      const subtasks = subtasksByParent.get(task.id) ?? [];
      return {
        task,
        subtasks,
        subtaskProgress:
          subtasks.length === 0 ? null : computeProgress(subtasks),
      };
    };

    const toProjectView = (project: Project): ProjectView => {
      const projectTasks = topLevelByProject.get(project.id) ?? [];
      return {
        project,
        progress: computeProgress(projectTasks),
        tasks: projectTasks.map(toTaskView),
      };
    };

    const allGoals = store.listGoals();
    const allProjects = store.listProjects();
    const visibleProjects = allProjects.filter((p) => p.status !== 'archived');

    const goals = allGoals
      .filter((g) => g.status !== 'archived')
      .map((goal): GoalView => {
        const projectViews = visibleProjects
          .filter((p) => p.goalId === goal.id)
          .map(toProjectView);
        // Goal progress counts every top-level task of its visible projects once.
        const allTasks = projectViews.flatMap((view) =>
          view.tasks.map((t) => t.task),
        );
        return {
          goal,
          progress: computeProgress(allTasks),
          projects: projectViews,
        };
      });

    return {
      goals,
      standaloneProjects: visibleProjects
        .filter((p) => p.goalId === null)
        .map(toProjectView),
      inbox: (topLevelByProject.get(null) ?? []).map(toTaskView),
      archived: {
        goals: allGoals.filter((g) => g.status === 'archived'),
        projects: allProjects.filter((p) => p.status === 'archived'),
      },
    };
  }

  return {
    createGoal,
    updateGoal,
    setGoalStatus,
    createProject,
    updateProject,
    setProjectStatus,
    createTask,
    updateTask,
    setTaskStatus,
    postponeTask,
    getDashboard,
  };
}

export type UseCases = ReturnType<typeof createUseCases>;
