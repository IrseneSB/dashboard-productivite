// Milestone 4 end to end: the "What should I work on now?" card.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addDays, localIsoDate } from '../../src/domain/dates';
import { createDataDir, launch, quickAdd } from './helpers';

let data: ReturnType<typeof createDataDir>;

beforeAll(() => {
  data = createDataDir();
});

afterAll(() => {
  data.remove();
});

describe('milestone 4 in the real app', () => {
  it('suggests a task with its reasons, and updates after Start and Mark done', async () => {
    const today = localIsoDate(new Date());
    const { app, page } = await launch(data.path);
    const card = page.getByRole('region', { name: 'Work on next' });
    try {
      // CA-4.6 is shown once there is something on the dashboard but nothing to do.
      await quickAdd(page, 'goal', 'Semester');
      await card.getByText('No open task').waitFor();

      await quickAdd(page, 'project', 'Quiz', { parent: 'Semester' });
      const parent = 'Semester › Quiz';
      await quickAdd(page, 'task', 'Read chapter 4', {
        parent,
        priority: 'high',
      });
      await quickAdd(page, 'task', 'Late exercise', {
        parent,
        dueDate: addDays(today, -2),
      });
      await quickAdd(page, 'task', 'Plain task', { parent });

      // CA-4.1 / CA-4.2: overdue beats high priority; reasons are shown.
      const main = card.locator('.suggestion.main');
      await main.getByText('Late exercise').waitFor();
      expect(await main.textContent()).toContain('2 days overdue');

      // CA-4.4: two alternatives, in rule order.
      expect(
        await card.locator('.alternatives .suggestion-title').allTextContents(),
      ).toEqual(['Read chapter 4', 'Plain task']);

      // CA-4.5: Start marks it in progress, Mark done moves on to the next one.
      await card.getByRole('button', { name: 'Start' }).click();
      await main.getByText('in progress').waitFor();
      await card.getByRole('button', { name: 'Mark done' }).click();
      await main.getByText('Read chapter 4').waitFor();
      expect(await main.textContent()).toContain('high priority');

      await page.screenshot({ path: 'tests/e2e/last-run-m4.png' });
    } finally {
      await app.close();
    }
  });
});
