// Milestone 2 end to end: priorities and due dates, subtasks, postpone,
// edit, cancel, archive and restore, in the real app.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDataDir, launch, quickAdd, tree } from './helpers';

let data: ReturnType<typeof createDataDir>;

beforeAll(() => {
  data = createDataDir();
});

afterAll(() => {
  data.remove();
});

describe('milestone 2 in the real app', () => {
  it('edits, splits, postpones, cancels, completes, archives and restores', async () => {
    const { app, page } = await launch(data.path);
    const alert = page.getByRole('alert');
    try {
      await quickAdd(page, 'goal', 'Semester');
      await quickAdd(page, 'project', 'Testing quiz', { parent: 'Semester' });
      await quickAdd(page, 'task', 'Study', {
        parent: 'Semester › Testing quiz',
        priority: 'high',
        dueDate: '2026-11-02',
      });

      // CA-2.10: priority and due date are shown.
      await tree(page).getByText('due 2026-11-02').waitFor();
      expect(await page.locator('.badge.priority-high').count()).toBe(1);

      // CA-2.6: subtasks, with their own progress on the parent.
      for (const title of ['Chapter 1', 'Chapter 2']) {
        await tree(page).getByLabel('Add subtask to Study').click();
        await tree(page).getByLabel('New subtask of Study').fill(title);
        await page
          .getByRole('button', { name: 'Add', exact: true })
          .last()
          .click();
        await tree(page).getByText(title, { exact: true }).waitFor();
      }
      await page.getByText('0 of 2 subtasks').waitFor();

      // CA-2.7: the parent cannot be done while subtasks are open.
      await tree(page)
        .getByRole('checkbox', { name: 'Study', exact: true })
        .click();
      await alert.waitFor();
      expect(await alert.textContent()).toContain(
        'Finish or cancel its 2 open subtasks first.',
      );

      await tree(page)
        .getByRole('checkbox', { name: 'Chapter 1', exact: true })
        .click();
      await page.getByText('1 of 2 subtasks').waitFor();
      // Project progress counts the parent only: still 0 of 1.
      await page.getByText('0 of 1 task done').waitFor();

      // CA-2.5: postpone by one day.
      await tree(page).getByLabel('Postpone Study by 1 day').click();
      await tree(page).getByText('due 2026-11-03').waitFor();

      // CA-2.1: an invalid edit is refused, a valid one is saved.
      await tree(page).getByLabel('Edit Study').click();
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('Title').fill('   ');
      await dialog.getByRole('button', { name: 'Save' }).click();
      expect(await dialog.getByRole('alert').textContent()).toContain(
        'Title cannot be empty.',
      );
      await dialog.getByLabel('Title').fill('Study for the quiz');
      await dialog.getByRole('button', { name: 'Save' }).click();
      await tree(page)
        .getByText('Study for the quiz', { exact: true })
        .waitFor();

      // CA-2.4: cancel the remaining subtask, then the parent can be done.
      await tree(page).getByLabel('Cancel Chapter 2').click();
      await tree(page)
        .getByRole('checkbox', { name: 'Study for the quiz', exact: true })
        .click();
      await page.getByText('1 of 1 task done').waitFor();

      // CA-2.2: archive the goal, then restore it with its content.
      await page.getByLabel('Archive Semester').click();
      await page.getByText('Archived (1)').waitFor();
      expect(await page.getByText('1 of 1 task done').count()).toBe(0);

      await page.getByText('Archived (1)').click();
      await page.getByLabel('Restore Semester').click();
      await page.getByText('1 of 1 task done').waitFor();
      await page.screenshot({ path: 'tests/e2e/last-run-m2.png' });
    } finally {
      await app.close();
    }
  });
});
