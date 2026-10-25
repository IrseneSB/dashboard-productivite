// Milestone 3 end to end: the Focus panel in the real app. Due dates are
// computed from the real "today", because the app uses the real clock.

import type { Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addDays, localIsoDate } from '../../src/domain/dates';
import { createDataDir, launch, quickAdd, tree } from './helpers';

let data: ReturnType<typeof createDataDir>;

beforeAll(() => {
  data = createDataDir();
});

afterAll(() => {
  data.remove();
});

const section = (page: Page, title: string) =>
  page.getByRole('region', { name: 'Focus' }).locator('.focus-list', {
    has: page.getByRole('heading', { name: new RegExp(`^${title}`) }),
  });

const titlesIn = async (page: Page, title: string) =>
  section(page, title).locator('.task-title span').allTextContents();

async function waitIfCloseToMidnight(marginMs = 120_000) {
  const midnight = new Date();
  midnight.setHours(24, 0, 1, 0);
  const left = midnight.getTime() - Date.now();
  if (left < marginMs) await new Promise((r) => setTimeout(r, left));
}

describe('milestone 3 in the real app', () => {
  it('fills overdue, upcoming, blocked and recently completed', async () => {
    // The test and the app each read the clock. If a run started just before
    // midnight, they could disagree on "today": wait until the new day instead
    // (code review, M3).
    await waitIfCloseToMidnight();
    const today = localIsoDate(new Date());
    const { app, page } = await launch(data.path);
    try {
      await quickAdd(page, 'goal', 'Semester');
      await quickAdd(page, 'project', 'Quiz', { parent: 'Semester' });
      const parent = 'Semester › Quiz';
      await quickAdd(page, 'task', 'Late task', {
        parent,
        dueDate: addDays(today, -1),
      });
      await quickAdd(page, 'task', 'Soon task', { parent, dueDate: today });
      await quickAdd(page, 'task', 'Later task', {
        parent,
        dueDate: addDays(today, 3),
      });
      await quickAdd(page, 'task', 'Far task', {
        parent,
        dueDate: addDays(today, 20),
      });
      await quickAdd(page, 'task', 'Stuck task', { parent });

      // CA-3.1 and CA-3.5: overdue, with days late and where it belongs.
      await section(page, 'Overdue').getByText('1 day late').waitFor();
      expect(await titlesIn(page, 'Overdue')).toEqual(['Late task']);
      expect(
        await section(page, 'Overdue').locator('.context').textContent(),
      ).toBe('Semester › Quiz');

      // CA-3.2: today first, then within 7 days; 20 days ahead is not shown.
      expect(await titlesIn(page, 'Upcoming')).toEqual([
        'Soon task',
        'Later task',
      ]);
      await section(page, 'Upcoming').getByText('today').waitFor();

      // CA-3.7: an empty section says so.
      await section(page, 'Blocked').getByText('Nothing blocked.').waitFor();

      // CA-3.3: set a task to blocked from the edit dialog.
      await tree(page).getByLabel('Edit Stuck task').click();
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('Status').selectOption('blocked');
      await dialog.getByRole('button', { name: 'Save' }).click();
      await section(page, 'Blocked').getByText('Stuck task').waitFor();

      // CA-3.4: completing a task moves it to Recently completed.
      await tree(page)
        .getByRole('checkbox', { name: 'Soon task', exact: true })
        .click();
      await section(page, 'Recently completed')
        .getByText('Soon task')
        .waitFor();
      expect(await titlesIn(page, 'Upcoming')).toEqual(['Later task']);

      await page.screenshot({ path: 'tests/e2e/last-run-m3.png' });
    } finally {
      await app.close();
    }
  });
});
