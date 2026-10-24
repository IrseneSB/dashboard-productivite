import { describe, expect, it } from 'vitest';
import { computeProgress } from '../../src/domain/progress';
import type { TaskStatus } from '../../src/domain/model';

const tasks = (...statuses: TaskStatus[]) =>
  statuses.map((status) => ({ status }));

describe('computeProgress (ADR-004, option A: every task counts the same)', () => {
  it('returns an unknown ratio, not 0%, when there are no tasks (CA-1.5)', () => {
    expect(computeProgress([])).toEqual({ done: 0, total: 0, ratio: null });
  });

  it('counts done tasks against all non-cancelled tasks (CA-1.1, CA-1.2)', () => {
    expect(computeProgress(tasks('todo'))).toEqual({
      done: 0,
      total: 1,
      ratio: 0,
    });
    expect(computeProgress(tasks('done'))).toEqual({
      done: 1,
      total: 1,
      ratio: 1,
    });
    expect(
      computeProgress(tasks('done', 'todo', 'in_progress', 'blocked')),
    ).toEqual({
      done: 1,
      total: 4,
      ratio: 0.25,
    });
  });

  it('removes cancelled tasks from the total (CA-1.5)', () => {
    expect(computeProgress(tasks('done', 'cancelled'))).toEqual({
      done: 1,
      total: 1,
      ratio: 1,
    });
  });

  it('treats a project with only cancelled tasks as having nothing to measure', () => {
    expect(computeProgress(tasks('cancelled', 'cancelled')).ratio).toBeNull();
  });
});
