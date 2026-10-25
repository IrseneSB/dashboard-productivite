import { beforeEach, describe, expect, it } from 'vitest';
import { createUseCases, type UseCases } from '../../src/application/use-cases';
import { createMemoryStore } from '../../src/data/memory-store';
import { ValidationError } from '../../src/domain/validation';

let useCases: UseCases;

beforeEach(() => {
  let counter = 0;
  useCases = createUseCases({
    store: createMemoryStore(),
    now: () => new Date('2026-10-25T09:00:00.000Z'),
    newId: () => `id-${++counter}`,
  });
});

describe('vertical slice: goal -> project -> task -> dashboard', () => {
  it('shows a new goal with 0/1 task, then 1/1 once the task is done (CA-1.1, CA-1.2)', () => {
    const goal = useCases.createGoal({
      title: 'Prepare successfully for the semester',
    });
    const project = useCases.createProject({
      goalId: goal.id,
      title: 'Software Testing quiz',
    });
    const task = useCases.createTask({
      projectId: project.id,
      title: 'Review the main concepts',
    });

    let view = useCases.getDashboard().goals[0];
    expect(view.goal.title).toBe('Prepare successfully for the semester');
    expect(view.progress).toEqual({ done: 0, total: 1, ratio: 0 });
    expect(view.projects[0].tasks.map((t) => t.task.title)).toEqual([
      'Review the main concepts',
    ]);

    useCases.setTaskStatus(task.id, 'done');

    view = useCases.getDashboard().goals[0];
    expect(view.progress).toEqual({ done: 1, total: 1, ratio: 1 });
    expect(view.projects[0].progress.ratio).toBe(1);
  });

  it('weights goal progress by tasks, not by averaging projects (ADR-004)', () => {
    const goal = useCases.createGoal({
      title: 'Become a stronger backend developer',
    });
    const small = useCases.createProject({
      goalId: goal.id,
      title: 'Small project',
    });
    const big = useCases.createProject({
      goalId: goal.id,
      title: 'Big project',
    });
    const smallTask = useCases.createTask({
      projectId: small.id,
      title: 'Only task',
    });
    for (let i = 0; i < 3; i++)
      useCases.createTask({ projectId: big.id, title: `Big task ${i}` });

    useCases.setTaskStatus(smallTask.id, 'done');

    // Averaging projects would say (100% + 0%) / 2 = 50%. Counting tasks says 1/4.
    expect(useCases.getDashboard().goals[0].progress).toEqual({
      done: 1,
      total: 4,
      ratio: 0.25,
    });
  });

  it('puts tasks without a project in the Inbox', () => {
    useCases.createTask({ title: 'Buy a notebook' });
    expect(useCases.getDashboard().inbox.map((t) => t.task.title)).toEqual([
      'Buy a notebook',
    ]);
  });

  it('lists projects without a goal separately', () => {
    useCases.createProject({ title: 'Side project' });
    const dashboard = useCases.getDashboard();
    expect(dashboard.goals).toEqual([]);
    expect(dashboard.standaloneProjects.map((p) => p.project.title)).toEqual([
      'Side project',
    ]);
  });
});

describe('invalid input is rejected before anything is saved (CA-1.4)', () => {
  it('rejects an empty goal title', () => {
    expect(() => useCases.createGoal({ title: '   ' })).toThrow(
      ValidationError,
    );
    expect(useCases.getDashboard().goals).toEqual([]);
  });

  it('rejects a project attached to a goal that does not exist', () => {
    expect(() =>
      useCases.createProject({ goalId: 'missing', title: 'Orphan' }),
    ).toThrow(/goal does not exist/);
  });

  it('rejects a task attached to a project that does not exist', () => {
    expect(() =>
      useCases.createTask({ projectId: 'missing', title: 'Orphan' }),
    ).toThrow(/project does not exist/);
  });

  it('rejects an unknown status', () => {
    const task = useCases.createTask({ title: 'Something' });
    expect(() => useCases.setTaskStatus(task.id, 'finished')).toThrow(
      /Unknown status/,
    );
  });
});
