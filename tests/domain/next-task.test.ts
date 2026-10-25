import { describe, expect, it } from 'vitest';
import type { FocusItem } from '../../src/domain/focus';
import type { Task } from '../../src/domain/model';
import { computeNextTask, RULES } from '../../src/domain/next-task';

const today = '2026-10-25';

let n = 0;
function item(overrides: Partial<Task>): FocusItem {
  n += 1;
  return {
    context: ['Goal', 'Project'],
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
      createdAt: new Date(Date.UTC(2026, 9, 1) + n * 1000).toISOString(),
      updatedAt: '2026-10-01T08:00:00.000Z',
      ...overrides,
    },
  };
}

const order = (items: FocusItem[]) => {
  const next = computeNextTask(items, today);
  return [next.suggestion, ...next.alternatives].map((s) => s!.item.task.title);
};

describe('each rule decides when the previous ones tie (CA-4.2)', () => {
  it('rule 2: overdue first, the most days late first', () => {
    expect(
      order([
        item({ title: 'High, due today', priority: 'high', dueDate: today }),
        item({ title: '1 day late', dueDate: '2026-10-24' }),
        item({ title: '5 days late', priority: 'low', dueDate: '2026-10-20' }),
      ]),
    ).toEqual(['5 days late', '1 day late', 'High, due today']);
  });

  it('rule 3: then due within 3 days, the soonest first', () => {
    expect(
      order([
        item({
          title: 'High, in 10 days',
          priority: 'high',
          dueDate: '2026-11-04',
        }),
        item({ title: 'In 3 days', priority: 'low', dueDate: '2026-10-28' }),
        item({ title: 'Tomorrow', priority: 'low', dueDate: '2026-10-26' }),
      ]),
    ).toEqual(['Tomorrow', 'In 3 days', 'High, in 10 days']);
  });

  it('rule 4: then priority', () => {
    expect(
      order([
        item({ title: 'Low', priority: 'low' }),
        item({ title: 'High', priority: 'high' }),
        item({ title: 'Medium', priority: 'medium' }),
      ]),
    ).toEqual(['High', 'Medium', 'Low']);
  });

  it('rule 5: then the earliest due date, tasks without a date last', () => {
    expect(
      order([
        item({ title: 'No date' }),
        item({ title: 'In 20 days', dueDate: '2026-11-14' }),
        item({ title: 'In 10 days', dueDate: '2026-11-04' }),
      ]),
    ).toEqual(['In 10 days', 'In 20 days', 'No date']);
  });

  it('rule 6: then the oldest task', () => {
    const newer = item({
      title: 'Newer',
      createdAt: '2026-10-20T08:00:00.000Z',
    });
    const older = item({
      title: 'Older',
      createdAt: '2026-10-02T08:00:00.000Z',
    });
    expect(order([newer, older])).toEqual(['Older', 'Newer']);
  });
});

describe('candidates (CA-4.3)', () => {
  it('never suggests blocked, done or cancelled tasks', () => {
    const next = computeNextTask(
      [
        item({ title: 'Blocked', status: 'blocked', priority: 'high' }),
        item({
          title: 'Done',
          status: 'done',
          completedAt: '2026-10-24T08:00:00.000Z',
        }),
        item({ title: 'Cancelled', status: 'cancelled' }),
        item({ title: 'Doable' }),
      ],
      today,
    );
    expect(next.suggestion!.item.task.title).toBe('Doable');
    expect(next.alternatives).toEqual([]);
  });

  it('replaces a parent with open subtasks by its subtasks', () => {
    const parent = item({
      title: 'Study',
      priority: 'high',
      dueDate: '2026-10-20',
    });
    const sub = item({ title: 'Chapter 1', parentTaskId: parent.task.id });
    const doneSub = item({
      title: 'Chapter 0',
      parentTaskId: parent.task.id,
      status: 'done',
      completedAt: '2026-10-24T08:00:00.000Z',
    });
    expect(order([parent, sub, doneSub])).toEqual(['Chapter 1']);
  });

  it('suggests a parent whose subtasks are all finished', () => {
    const parent = item({ title: 'Study' });
    const doneSub = item({
      title: 'Chapter 1',
      parentTaskId: parent.task.id,
      status: 'done',
      completedAt: '2026-10-24T08:00:00.000Z',
    });
    expect(order([parent, doneSub])).toEqual(['Study']);
  });
});

describe('reasons and alternatives (CA-4.1, CA-4.4)', () => {
  it('gives the reasons in plain words and at most two alternatives', () => {
    const next = computeNextTask(
      [
        item({ title: 'Late', priority: 'high', dueDate: '2026-10-23' }),
        item({ title: 'Tomorrow', dueDate: '2026-10-26' }),
        item({ title: 'Plain' }),
        item({ title: 'Another' }),
      ],
      today,
    );
    expect(next.suggestion!.reasons).toEqual([
      '2 days overdue',
      'high priority',
    ]);
    expect(
      next.alternatives.map((a) => [a.item.task.title, a.reasons]),
    ).toEqual([
      ['Tomorrow', ['due tomorrow']],
      ['Plain', ['no due date; older tasks come first']],
    ]);
  });
});

describe('rule explanation', () => {
  it('lists one sentence per sorting rule (rules 2 to 6)', () => {
    expect(RULES).toHaveLength(5);
  });
});

describe('nothing to suggest (CA-4.6)', () => {
  it('says that everything is blocked', () => {
    const next = computeNextTask([item({ status: 'blocked' })], today);
    expect(next.suggestion).toBeNull();
    expect(next.emptyReason).toMatch(/Every open task is blocked/);
  });

  it('says that there is no open task', () => {
    expect(computeNextTask([], today).emptyReason).toMatch(/No open task/);
  });
});
