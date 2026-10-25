import { beforeEach, describe, expect, it } from 'vitest';
import { createUseCases, type UseCases } from '../../src/application/use-cases';
import { createMemoryStore } from '../../src/data/memory-store';
import { ValidationError } from '../../src/domain/validation';

let app: UseCases;

beforeEach(() => {
  let counter = 0;
  app = createUseCases({
    store: createMemoryStore(),
    // Midday, so the local date is 2026-10-25 in every time zone from UTC-11 to UTC+11.
    now: () => new Date('2026-10-25T12:00:00.000Z'),
    newId: () => `id-${++counter}`,
  });
});

function semester() {
  const goal = app.createGoal({ title: 'Prepare for the semester' });
  const project = app.createProject({
    goalId: goal.id,
    title: 'Software Testing quiz',
  });
  const task = app.createTask({
    projectId: project.id,
    title: 'Practice questions',
  });
  return { goal, project, task };
}

describe('CA-2.1 editing', () => {
  it('updates only the fields that are given', () => {
    const { goal, task } = semester();
    app.updateGoal(goal.id, {
      description: 'All courses',
      targetDate: '2027-01-31',
    });
    app.updateTask(task.id, {
      title: 'Complete practice questions',
      priority: 'high',
    });

    const view = app.getDashboard().goals[0];
    expect(view.goal).toMatchObject({
      title: 'Prepare for the semester',
      description: 'All courses',
      targetDate: '2027-01-31',
    });
    expect(view.projects[0].tasks[0].task).toMatchObject({
      title: 'Complete practice questions',
      priority: 'high',
      notes: '',
    });
  });

  it('clears an optional date with null', () => {
    const { project } = semester();
    app.updateProject(project.id, { targetDate: '2026-11-15' });
    app.updateProject(project.id, { targetDate: null });
    expect(
      app.getDashboard().goals[0].projects[0].project.targetDate,
    ).toBeNull();
  });

  it('saves nothing when one field is invalid', () => {
    const { task } = semester();
    expect(() =>
      app.updateTask(task.id, { title: 'New title', dueDate: '2026-02-30' }),
    ).toThrow(ValidationError);
    expect(app.getDashboard().goals[0].projects[0].tasks[0].task.title).toBe(
      'Practice questions',
    );
  });
});

describe('CA-2.2 / CA-2.3 archiving', () => {
  it('moves an archived goal and its projects out of the dashboard, and restores them', () => {
    const { goal } = semester();
    app.setGoalStatus(goal.id, 'archived');

    let dashboard = app.getDashboard();
    expect(dashboard.goals).toEqual([]);
    expect(dashboard.archived.goals.map((g) => g.title)).toEqual([
      'Prepare for the semester',
    ]);

    app.setGoalStatus(goal.id, 'active');
    dashboard = app.getDashboard();
    expect(
      dashboard.goals[0].projects[0].tasks.map((t) => t.task.title),
    ).toEqual(['Practice questions']);
  });

  it('excludes an archived project from its goal and from the goal progress', () => {
    const { goal, project, task } = semester();
    const other = app.createProject({ goalId: goal.id, title: 'Other' });
    app.createTask({ projectId: other.id, title: 'Open task' });
    app.setTaskStatus(task.id, 'done');
    app.setProjectStatus(other.id, 'archived');

    const view = app.getDashboard().goals[0];
    expect(view.projects.map((p) => p.project.id)).toEqual([project.id]);
    expect(view.progress).toEqual({ done: 1, total: 1, ratio: 1 });
  });

  it('refuses new work under an archived goal or project', () => {
    const { goal, project } = semester();
    app.setProjectStatus(project.id, 'archived');
    expect(() => app.createTask({ projectId: project.id, title: 'x' })).toThrow(
      /archived/,
    );

    app.setGoalStatus(goal.id, 'archived');
    expect(() => app.createProject({ goalId: goal.id, title: 'x' })).toThrow(
      /archived/,
    );
  });

  it('refuses to restore a project whose goal is archived', () => {
    const { goal, project } = semester();
    app.setProjectStatus(project.id, 'archived');
    app.setGoalStatus(goal.id, 'archived');
    expect(() => app.setProjectStatus(project.id, 'active')).toThrow(
      /Restore the goal first/,
    );
  });
});

describe('CA-2.4 cancelling', () => {
  it('keeps a cancelled task visible and removes it from progress', () => {
    const { project, task } = semester();
    const other = app.createTask({
      projectId: project.id,
      title: 'Review mistakes',
    });
    app.setTaskStatus(other.id, 'done');
    app.setTaskStatus(task.id, 'cancelled');

    const view = app.getDashboard().goals[0].projects[0];
    expect(view.tasks.map((t) => t.task.status)).toEqual(['cancelled', 'done']);
    expect(view.progress).toEqual({ done: 1, total: 1, ratio: 1 });
  });

  it('cancels the open subtasks of a cancelled task, but not the finished ones', () => {
    const { task } = semester();
    const a = app.createTask({ parentTaskId: task.id, title: 'Chapter 1' });
    const b = app.createTask({ parentTaskId: task.id, title: 'Chapter 2' });
    app.setTaskStatus(a.id, 'done');
    app.setTaskStatus(task.id, 'cancelled');

    const subtasks = app.getDashboard().goals[0].projects[0].tasks[0].subtasks;
    expect(subtasks.map((s) => [s.id, s.status])).toEqual([
      [a.id, 'done'],
      [b.id, 'cancelled'],
    ]);
  });
});

describe('CA-2.5 postponing', () => {
  it('moves the due date by one day or one week', () => {
    const { project } = semester();
    const task = app.createTask({
      projectId: project.id,
      title: 'Quiz',
      dueDate: '2026-10-28',
    });
    expect(app.postponeTask(task.id, 1).dueDate).toBe('2026-10-29');
    expect(app.postponeTask(task.id, 7).dueDate).toBe('2026-11-05');
  });

  it('counts from today when there is no due date', () => {
    const { task } = semester();
    expect(app.postponeTask(task.id, 1).dueDate).toBe('2026-10-26');
  });

  it('refuses to postpone a finished task or by an invalid number of days', () => {
    const { task } = semester();
    expect(() => app.postponeTask(task.id, 0)).toThrow(/1 to 365/);
    app.setTaskStatus(task.id, 'done');
    expect(() => app.postponeTask(task.id, 1)).toThrow(/cannot be postponed/);
  });
});

describe('CA-2.6 / CA-2.7 subtasks', () => {
  it('shows subtask progress on the parent; project progress counts the parent only', () => {
    const { task } = semester();
    const a = app.createTask({ parentTaskId: task.id, title: 'Chapter 1' });
    app.createTask({ parentTaskId: task.id, title: 'Chapter 2' });
    app.setTaskStatus(a.id, 'done');

    const project = app.getDashboard().goals[0].projects[0];
    expect(project.tasks).toHaveLength(1);
    expect(project.tasks[0].subtaskProgress).toEqual({
      done: 1,
      total: 2,
      ratio: 0.5,
    });
    expect(project.progress).toEqual({ done: 0, total: 1, ratio: 0 });
  });

  it("puts a subtask in its parent's project, even without a projectId", () => {
    const { project, task } = semester();
    const sub = app.createTask({ parentTaskId: task.id, title: 'Chapter 1' });
    expect(sub.projectId).toBe(project.id);
    expect(app.getDashboard().inbox).toEqual([]);
  });

  it('allows only one level of subtasks', () => {
    const { task } = semester();
    const sub = app.createTask({ parentTaskId: task.id, title: 'Chapter 1' });
    expect(() =>
      app.createTask({ parentTaskId: sub.id, title: 'Too deep' }),
    ).toThrow(/cannot have its own subtasks/);
  });

  it('refuses to complete a parent with open subtasks', () => {
    const { task } = semester();
    const a = app.createTask({ parentTaskId: task.id, title: 'Chapter 1' });
    expect(() => app.setTaskStatus(task.id, 'done')).toThrow(
      /1 open subtask first/,
    );
    app.setTaskStatus(a.id, 'done');
    expect(app.setTaskStatus(task.id, 'done').status).toBe('done');
  });

  it('refuses to add or reopen a subtask under a done parent', () => {
    const { task } = semester();
    const a = app.createTask({ parentTaskId: task.id, title: 'Chapter 1' });
    app.setTaskStatus(a.id, 'done');
    app.setTaskStatus(task.id, 'done');
    expect(() =>
      app.createTask({ parentTaskId: task.id, title: 'Late' }),
    ).toThrow(/Reopen it/);
    expect(() => app.setTaskStatus(a.id, 'todo')).toThrow(
      /Reopen it before reopening/,
    );
  });
});

describe('CA-2.8 moving a task', () => {
  it('moves its subtasks with it', () => {
    const { goal, task } = semester();
    const target = app.createProject({ goalId: goal.id, title: 'Target' });
    app.createTask({ parentTaskId: task.id, title: 'Chapter 1' });

    app.updateTask(task.id, { projectId: target.id });

    const projects = app.getDashboard().goals[0].projects;
    expect(projects[0].tasks).toEqual([]);
    expect(projects[1].tasks[0].subtasks.map((s) => s.projectId)).toEqual([
      target.id,
    ]);
  });

  it('can move a task to the Inbox', () => {
    const { task } = semester();
    app.updateTask(task.id, { projectId: null });
    expect(app.getDashboard().inbox.map((t) => t.task.id)).toEqual([task.id]);
  });

  it('refuses to move a subtask on its own, or into an archived project', () => {
    const { goal, task } = semester();
    const sub = app.createTask({ parentTaskId: task.id, title: 'Chapter 1' });
    const archived = app.createProject({ goalId: goal.id, title: 'Old' });
    app.setProjectStatus(archived.id, 'archived');
    expect(() => app.updateTask(sub.id, { projectId: archived.id })).toThrow(
      /parent's project/,
    );
    expect(() => app.updateTask(task.id, { projectId: archived.id })).toThrow(
      /archived/,
    );
  });
});

describe('code review fixes (M2)', () => {
  it('answers a malformed request with a validation message, not a crash', () => {
    const { task } = semester();
    expect(() => app.updateTask(task.id, null as never)).toThrow(
      /form data is missing/,
    );
    expect(() => app.createGoal('Semester' as never)).toThrow(ValidationError);
  });
});
