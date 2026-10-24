import { describe, expect, it } from 'vitest';
import type { Task } from '../../src/domain/model';
import { canTransition, transitionTask } from '../../src/domain/task-status';
import { ValidationError } from '../../src/domain/validation';

const base: Task = {
  id: 't1',
  projectId: null,
  title: 'Review the main concepts',
  notes: '',
  priority: 'medium',
  dueDate: null,
  status: 'todo',
  completedAt: null,
  createdAt: '2026-10-01T08:00:00.000Z',
  updatedAt: '2026-10-01T08:00:00.000Z',
};
const now = '2026-10-02T10:00:00.000Z';

describe('task status transitions', () => {
  it('records completedAt when a task is done', () => {
    const done = transitionTask(base, 'done', now);
    expect(done.status).toBe('done');
    expect(done.completedAt).toBe(now);
    expect(done.updatedAt).toBe(now);
  });

  it('clears completedAt when a done task is reopened', () => {
    const reopened = transitionTask(
      transitionTask(base, 'done', now),
      'todo',
      now,
    );
    expect(reopened.status).toBe('todo');
    expect(reopened.completedAt).toBeNull();
  });

  it('rejects a done task going straight to in_progress (must be reopened first)', () => {
    const done = transitionTask(base, 'done', now);
    expect(canTransition('done', 'in_progress')).toBe(false);
    expect(() => transitionTask(done, 'in_progress', now)).toThrow(
      ValidationError,
    );
  });

  it('returns the same object when the status does not change', () => {
    expect(transitionTask(base, 'todo', now)).toBe(base);
  });

  it('does not modify the original task (pure function)', () => {
    transitionTask(base, 'done', now);
    expect(base.status).toBe('todo');
  });
});
