// Validation rules shared by every entry point. The UI calls them to show
// errors early; the application layer calls them again before saving, because
// the UI is not the only possible caller and must not be trusted.

import { PRIORITIES, type IsoDate, type Priority } from './model';

export const TITLE_MAX_LENGTH = 200;
export const TEXT_MAX_LENGTH = 5000;

/** Raised when user input breaks a business rule. The message is shown to the user. */
export class ValidationError extends Error {
  constructor(
    public readonly field: string,
    message: string,
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function validateTitle(raw: unknown, field = 'title'): string {
  if (typeof raw !== 'string') {
    throw new ValidationError(field, 'Title is required.');
  }
  const title = raw.trim();
  if (title.length === 0) {
    throw new ValidationError(field, 'Title cannot be empty.');
  }
  if (title.length > TITLE_MAX_LENGTH) {
    throw new ValidationError(
      field,
      `Title must be at most ${TITLE_MAX_LENGTH} characters.`,
    );
  }
  return title;
}

export function validateText(raw: unknown, field: string): string {
  if (raw === undefined || raw === null) return '';
  if (typeof raw !== 'string') {
    throw new ValidationError(field, `${field} must be text.`);
  }
  const text = raw.trim();
  if (text.length > TEXT_MAX_LENGTH) {
    throw new ValidationError(
      field,
      `${field} must be at most ${TEXT_MAX_LENGTH} characters.`,
    );
  }
  return text;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Accepts null/empty (no date) or a real calendar date in YYYY-MM-DD form. */
export function validateOptionalDate(
  raw: unknown,
  field: string,
): IsoDate | null {
  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw !== 'string') {
    throw new ValidationError(field, 'Date must be in YYYY-MM-DD format.');
  }
  const match = ISO_DATE.exec(raw);
  if (!match) {
    throw new ValidationError(field, 'Date must be in YYYY-MM-DD format.');
  }
  const [, y, m, d] = match.map(Number);
  // Date.UTC rolls invalid days over (Feb 30 -> Mar 2), so compare the parts back.
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    throw new ValidationError(field, 'This date does not exist.');
  }
  return raw;
}

export function validatePriority(raw: unknown): Priority {
  if (raw === undefined || raw === null || raw === '') return 'medium';
  if (
    typeof raw === 'string' &&
    (PRIORITIES as readonly string[]).includes(raw)
  ) {
    return raw as Priority;
  }
  throw new ValidationError(
    'priority',
    `Priority must be one of: ${PRIORITIES.join(', ')}.`,
  );
}
