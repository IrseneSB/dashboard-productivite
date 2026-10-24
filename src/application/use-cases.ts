// Use cases: one function per user action. Each one validates its input,
// applies the domain rules and saves the result through the Store.
// They know nothing about Electron, IPC or React.

import type { Goal, Id, Project, Task, TaskStatus } from '../domain/model';
import { TASK_STATUSES } from '../domain/model';
import { computeProgress, type Progress } from '../domain/progress';
import { transitionTask } from '../domain/task-status';
import {
  ValidationError,
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

export interface CreateProjectInput {
  goalId?: Id | null;
  title: string;
  description?: string;
  targetDate?: string | null;
}

export interface CreateTaskInput {
  projectId?: Id | null;
  title: string;
  notes?: string;
  priority?: string;
  dueDate?: string | null;
}

export interface ProjectView {
  project: Project;
  progress: Progress;
  tasks: Task[];
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
  /** Tasks outside any project. */
  inbox: Task[];
}

export function createUseCases({ store, now, newId }: Dependencies) {
  const timestamp = () => now().toISOString();

  function createGoal(input: CreateGoalInput): Goal {
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

  function createProject(input: CreateProjectInput): Project {
    const goalId = input.goalId ?? null;
    if (goalId !== null && !store.getGoal(goalId)) {
      throw new ValidationError('goalId', 'The selected goal does not exist.');
    }
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

  function createTask(input: CreateTaskInput): Task {
    const projectId = input.projectId ?? null;
    if (projectId !== null && !store.getProject(projectId)) {
      throw new ValidationError(
        'projectId',
        'The selected project does not exist.',
      );
    }
    const at = timestamp();
    const task: Task = {
      id: newId(),
      projectId,
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

  function setTaskStatus(taskId: Id, status: string): Task {
    if (!(TASK_STATUSES as readonly string[]).includes(status)) {
      throw new ValidationError('status', `Unknown status "${status}".`);
    }
    const task = store.getTask(taskId);
    if (!task) {
      throw new ValidationError('taskId', 'This task no longer exists.');
    }
    const updated = transitionTask(task, status as TaskStatus, timestamp());
    if (updated !== task) store.updateTask(updated);
    return updated;
  }

  function getDashboard(): DashboardView {
    const tasks = store.listTasks();
    const tasksByProject = new Map<Id, Task[]>();
    const inbox: Task[] = [];
    for (const task of tasks) {
      if (task.projectId === null) {
        inbox.push(task);
      } else {
        const list = tasksByProject.get(task.projectId) ?? [];
        list.push(task);
        tasksByProject.set(task.projectId, list);
      }
    }

    const toProjectView = (project: Project): ProjectView => {
      const projectTasks = tasksByProject.get(project.id) ?? [];
      return {
        project,
        progress: computeProgress(projectTasks),
        tasks: projectTasks,
      };
    };

    const projects = store
      .listProjects()
      .filter((p) => p.status !== 'archived');
    const goals = store
      .listGoals()
      .filter((g) => g.status !== 'archived')
      .map((goal): GoalView => {
        const projectViews = projects
          .filter((p) => p.goalId === goal.id)
          .map(toProjectView);
        // Goal progress counts every task of every project once (see progress.ts).
        const allTasks = projectViews.flatMap((view) => view.tasks);
        return {
          goal,
          progress: computeProgress(allTasks),
          projects: projectViews,
        };
      });

    return {
      goals,
      standaloneProjects: projects
        .filter((p) => p.goalId === null)
        .map(toProjectView),
      inbox,
    };
  }

  return { createGoal, createProject, createTask, setTaskStatus, getDashboard };
}

export type UseCases = ReturnType<typeof createUseCases>;
