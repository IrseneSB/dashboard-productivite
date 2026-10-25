// End-to-end test: drives the real Electron app (main process, preload, React
// UI and SQLite) through the milestone 1 workflow, including a restart.
//
// It runs the production build in .vite/ (created by `npm run package`), with a
// temporary data folder so the real database is never touched.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDataDir, launch as launchIn, quickAdd } from './helpers';

let data: ReturnType<typeof createDataDir>;
const launch = () => launchIn(data.path);

beforeAll(() => {
  data = createDataDir();
});

afterAll(() => {
  data.remove();
});

describe('milestone 1 vertical slice in the real app', () => {
  it('creates goal → project → task, completes it, and keeps it after a restart', async () => {
    let { app, page } = await launch();
    try {
      // Empty state is explained, not blank.
      await expect(
        page.getByText('Start with a long-term goal').isVisible(),
      ).resolves.toBe(true);

      // CA-1.4: an empty title is refused with the message from the main process.
      await page.getByLabel('What to create').selectOption('goal');
      await page.getByRole('button', { name: 'Add', exact: true }).click();
      await page.getByRole('alert').waitFor();
      expect(await page.getByRole('alert').textContent()).toContain(
        'Title cannot be empty.',
      );

      // CA-1.1
      await quickAdd(page, 'goal', 'Prepare successfully for the semester');
      await quickAdd(page, 'project', 'Software Testing quiz', {
        parent: 'Prepare successfully for the semester',
      });
      await quickAdd(page, 'task', 'Review the main concepts', {
        parent: 'Prepare successfully for the semester › Software Testing quiz',
      });
      await page.getByText('0 of 1 task done').waitFor();

      // CA-1.2: completing the task updates the gauge without a restart.
      // click(), not check(): the checkbox only shows the state the main
      // process has saved, so it changes after the round trip, not instantly
      // (see docs/learning-guide.md, chapter 8).
      await page
        .getByRole('checkbox', { name: 'Review the main concepts' })
        .click();
      await page.getByText('1 of 1 task done').waitFor();
      expect(
        await page
          .getByRole('checkbox', { name: 'Review the main concepts' })
          .isChecked(),
      ).toBe(true);
      await page.screenshot({ path: 'tests/e2e/last-run.png' });
    } finally {
      await app.close();
    }

    // CA-1.3: the data is still there after the app is closed and reopened.
    ({ app, page } = await launch());
    try {
      await page.getByText('1 of 1 task done').waitFor();
      expect(
        await page
          .getByRole('checkbox', { name: 'Review the main concepts' })
          .isChecked(),
      ).toBe(true);
    } finally {
      await app.close();
    }
  });
});
