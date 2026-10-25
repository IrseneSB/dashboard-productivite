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

describe('milestone 3: focus sections in the dashboard (CA-3.5, CA-3.6, A11)', () => {
  it('shows where each item belongs, including subtasks and the Inbox', () => {
    const { task } = semester();
    app.updateTask(task.id, { dueDate: '2026-10-20' });
    app.createTask({
      parentTaskId: task.id,
      title: 'Chapter 1',
      dueDate: '2026-10-26',
    });
    app.createTask({ title: 'Buy a notebook', dueDate: '2026-10-25' });

    const { focus } = app.getDashboard();
    expect(
      focus.overdue.map((o) => [o.task.title, o.context, o.daysLate]),
    ).toEqual([
      [
        'Practice questions',
        ['Prepare for the semester', 'Software Testing quiz'],
        5,
      ],
    ]);
    expect(focus.upcoming.map((u) => [u.task.title, u.context])).toEqual([
      ['Buy a notebook', []],
      [
        'Chapter 1',
        [
          'Prepare for the semester',
          'Software Testing quiz',
          'Practice questions',
        ],
      ],
    ]);
  });

  it('leaves out work inside an archived goal or project', () => {
    const { goal, task } = semester();
    app.updateTask(task.id, { dueDate: '2026-10-20' });
    app.setGoalStatus(goal.id, 'archived');
    expect(app.getDashboard().focus.overdue).toEqual([]);
  });
});

describe('CA-3.3 status from the edit form (code review, M3)', () => {
  it('saves fields and status in one call', () => {
    const { task } = semester();
    const updated = app.updateTask(task.id, {
      title: 'Waiting',
      status: 'blocked',
    });
    expect(updated).toMatchObject({ title: 'Waiting', status: 'blocked' });
    expect(app.getDashboard().focus.blocked.map((b) => b.task.title)).toEqual([
      'Waiting',
    ]);
  });

  it('saves nothing when the status is accepted but another field is not', () => {
    const { task } = semester();
    expect(() =>
      app.updateTask(task.id, { status: 'blocked', dueDate: '2026-02-30' }),
    ).toThrow(ValidationError);
    expect(app.getDashboard().focus.blocked).toEqual([]);
  });

  it('refuses done or cancelled through the edit form, and editing the status of a closed task', () => {
    const { task } = semester();
    expect(() => app.updateTask(task.id, { status: 'done' })).toThrow(
      /only be set/,
    );
    app.setTaskStatus(task.id, 'cancelled');
    expect(() => app.updateTask(task.id, { status: 'todo' })).toThrow(
      /Reopen it first/,
    );
  });
});

describe('milestone 4: suggestion in the dashboard', () => {
  it('only suggests visible work (CA-4.3)', () => {
    const { goal, task } = semester();
    app.updateTask(task.id, { priority: 'high' });
    app.createTask({ title: 'Inbox task' });
    expect(app.getDashboard().next.suggestion?.item.task.title).toBe(
      'Practice questions',
    );

    app.setGoalStatus(goal.id, 'archived');
    expect(app.getDashboard().next.suggestion?.item.task.title).toBe(
      'Inbox task',
    );
  });
});

describe('code review fixes (M4)', () => {
  it('does not suggest work from a completed project, but still shows it in Focus', () => {
    const { project, task } = semester();
    app.updateTask(task.id, { dueDate: '2026-10-20' });
    app.setProjectStatus(project.id, 'completed');
    const dashboard = app.getDashboard();
    expect(dashboard.next.suggestion).toBeNull();
    expect(dashboard.focus.overdue.map((o) => o.task.title)).toEqual([
      'Practice questions',
    ]);
  });
});
