import { describe, expect, it } from 'vitest';
import {
  TITLE_MAX_LENGTH,
  ValidationError,
  validateOptionalDate,
  validatePriority,
  validateTitle,
} from '../../src/domain/validation';

describe('validateTitle (CA-1.4)', () => {
  it('trims surrounding spaces', () => {
    expect(validateTitle('  Prepare the quiz  ')).toBe('Prepare the quiz');
  });

  it.each(['', '   ', undefined, null, 42])('rejects %j', (value) => {
    expect(() => validateTitle(value)).toThrow(ValidationError);
  });

  it('rejects titles that are too long', () => {
    expect(() => validateTitle('x'.repeat(TITLE_MAX_LENGTH + 1))).toThrow(
      /at most/,
    );
    expect(validateTitle('x'.repeat(TITLE_MAX_LENGTH))).toHaveLength(
      TITLE_MAX_LENGTH,
    );
  });
});

describe('validateOptionalDate', () => {
  it('treats empty values as "no date"', () => {
    expect(validateOptionalDate('', 'dueDate')).toBeNull();
    expect(validateOptionalDate(null, 'dueDate')).toBeNull();
    expect(validateOptionalDate(undefined, 'dueDate')).toBeNull();
  });

  it('accepts a real date', () => {
    expect(validateOptionalDate('2026-02-28', 'dueDate')).toBe('2026-02-28');
    expect(validateOptionalDate('2028-02-29', 'dueDate')).toBe('2028-02-29'); // leap year
  });

  it('rejects dates that do not exist or are badly formatted', () => {
    expect(() => validateOptionalDate('2026-02-30', 'dueDate')).toThrow(
      /does not exist/,
    );
    expect(() => validateOptionalDate('2026-13-01', 'dueDate')).toThrow(
      ValidationError,
    );
    expect(() => validateOptionalDate('25/10/2026', 'dueDate')).toThrow(
      /YYYY-MM-DD/,
    );
  });
});

describe('validatePriority', () => {
  it('defaults to medium', () => {
    expect(validatePriority(undefined)).toBe('medium');
  });

  it('rejects unknown values', () => {
    expect(() => validatePriority('urgent')).toThrow(ValidationError);
  });
});
