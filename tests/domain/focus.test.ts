import { describe, expect, it } from 'vitest';
import {
  computeFocus,
  RECENT_LIMIT,
  type FocusItem,
} from '../../src/domain/focus';
import type { Task } from '../../src/domain/model';

const today = '2026-10-25';

let n = 0;
function item(
  overrides: Partial<Task>,
  context: string[] = ['Goal', 'Project'],
): FocusItem {
  n += 1;
  return {
    context,
    task: {
      id: `t${n}`,
      projectId: 'p1',
      parentTaskId: null,
      title: `Task ${n}`,
      notes: '',
      priority: 'medium',
      dueDate: null,
      status: 'todo',
      completedAt: null,
      createdAt: '2026-10-01T12:00:00.000Z',
      updatedAt: '2026-10-01T12:00:00.000Z',
      ...overrides,
    },
  };
}

const titles = (items: FocusItem[]) => items.map((i) => i.task.title);

describe('overdue (CA-3.1)', () => {
  it('lists open tasks due before today, oldest first, with days late', () => {
    const focus = computeFocus(
      [
        item({ title: 'Yesterday', dueDate: '2026-10-24' }),
        item({ title: 'Last week', dueDate: '2026-10-18' }),
        item({ title: 'Today', dueDate: today }),
      ],
      today,
    );
    expect(focus.overdue.map((o) => [o.task.title, o.daysLate])).toEqual([
      ['Last week', 7],
      ['Yesterday', 1],
    ]);
  });
});

describe('upcoming (CA-3.2, A10, A12)', () => {
  it('lists open tasks due today to 7 days ahead, soonest first', () => {
    const focus = computeFocus(
      [
        item({ title: 'In 7 days', dueDate: '2026-11-01' }),
        item({ title: 'In 8 days', dueDate: '2026-11-02' }),
        item({ title: 'Today', dueDate: today }),
        item({ title: 'No date', dueDate: null }),
      ],
      today,
    );
    expect(focus.upcoming.map((u) => [u.task.title, u.daysLeft])).toEqual([
      ['Today', 0],
      ['In 7 days', 7],
    ]);
  });
});

describe('blocked (CA-3.3)', () => {
  it('lists blocked tasks, whatever their due date', () => {
    const focus = computeFocus(
      [
        item({ title: 'Waiting for teacher', status: 'blocked' }),
        item({
          title: 'Blocked and late',
          status: 'blocked',
          dueDate: '2026-10-20',
        }),
        item({ title: 'Normal', status: 'in_progress' }),
      ],
      today,
    );
    expect(titles(focus.blocked)).toEqual([
      'Blocked and late',
      'Waiting for teacher',
    ]);
    // A blocked task that is late is also overdue: both facts are true.
    expect(titles(focus.overdue)).toEqual(['Blocked and late']);
  });
});

describe('recently completed (CA-3.4)', () => {
  it('lists tasks done in the last 7 days, newest first', () => {
    const focus = computeFocus(
      [
        item({
          title: 'Two days ago',
          status: 'done',
          completedAt: '2026-10-23T12:00:00.000Z',
        }),
        item({
          title: 'This morning',
          status: 'done',
          completedAt: '2026-10-25T12:00:00.000Z',
        }),
        item({
          title: 'Long ago',
          status: 'done',
          completedAt: '2026-10-10T12:00:00.000Z',
        }),
      ],
      today,
    );
    expect(titles(focus.recentlyCompleted)).toEqual([
      'This morning',
      'Two days ago',
    ]);
  });

  it(`shows at most ${RECENT_LIMIT}`, () => {
    const many = Array.from({ length: RECENT_LIMIT + 5 }, () =>
      item({ status: 'done', completedAt: '2026-10-24T12:00:00.000Z' }),
    );
    expect(computeFocus(many, today).recentlyCompleted).toHaveLength(
      RECENT_LIMIT,
    );
  });
});

describe('recently completed uses calendar days (code review, M3)', () => {
  it('keeps today and the 6 previous days, whatever the time of completion', () => {
    const focus = computeFocus(
      [
        item({
          title: '6 days ago',
          status: 'done',
          completedAt: '2026-10-19T12:00:00.000Z',
        }),
        item({
          title: '7 days ago',
          status: 'done',
          completedAt: '2026-10-18T12:00:00.000Z',
        }),
      ],
      today,
    );
    expect(titles(focus.recentlyCompleted)).toEqual(['6 days ago']);
  });
});

describe('closed work never appears in the to-do sections (CA-3.6)', () => {
  it('ignores done and cancelled tasks even when they are late', () => {
    const focus = computeFocus(
      [
        item({
          status: 'done',
          dueDate: '2026-10-01',
          completedAt: '2026-10-02T12:00:00.000Z',
        }),
        item({ status: 'cancelled', dueDate: '2026-10-01' }),
      ],
      today,
    );
    expect(focus.overdue).toEqual([]);
    expect(focus.upcoming).toEqual([]);
    expect(focus.blocked).toEqual([]);
  });
});

describe('ordering is stable', () => {
  it('breaks ties by title so items do not jump between reloads', () => {
    const focus = computeFocus(
      [
        item({ title: 'B', dueDate: '2026-10-26' }),
        item({ title: 'A', dueDate: '2026-10-26' }),
      ],
      today,
    );
    expect(titles(focus.upcoming)).toEqual(['A', 'B']);
  });
});
