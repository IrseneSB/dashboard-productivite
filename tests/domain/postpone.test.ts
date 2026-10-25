import { describe, expect, it } from 'vitest';
import {
  addDays,
  localIsoDate,
  postponedDueDate,
} from '../../src/domain/dates';

describe('addDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29'); // leap year
  });

  it('is not affected by daylight-saving changes (works on calendar days)', () => {
    expect(addDays('2026-03-28', 7)).toBe('2026-04-04');
    expect(addDays('2026-10-24', 7)).toBe('2026-10-31');
  });
});

describe('postponedDueDate (CA-2.5, assumption A9)', () => {
  const today = '2026-10-25';

  it('moves an upcoming due date', () => {
    expect(postponedDueDate('2026-10-28', 1, today)).toBe('2026-10-29');
    expect(postponedDueDate('2026-10-28', 7, today)).toBe('2026-11-04');
  });

  it('counts from today when there is no due date', () => {
    expect(postponedDueDate(null, 1, today)).toBe('2026-10-26');
  });

  it('counts from today when the task is overdue, so it does not stay in the past', () => {
    expect(postponedDueDate('2026-10-01', 1, today)).toBe('2026-10-26');
  });

  it('moves a task due today to tomorrow', () => {
    expect(postponedDueDate(today, 1, today)).toBe('2026-10-26');
  });
});

describe('localIsoDate', () => {
  it('uses the local calendar date', () => {
    expect(localIsoDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});
