// Milestone 5 end to end: Settings in the development build. The start-at-login
// switch must be disabled here (CA-5.3); the export writes a real file through
// the real main process, with the native save dialog replaced by a stub.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDataDir, launch, quickAdd } from './helpers';

let data: ReturnType<typeof createDataDir>;

beforeAll(() => {
  data = createDataDir();
});

afterAll(() => {
  data.remove();
});

describe('milestone 5 in the real app (development build)', () => {
  it('disables start at login with the reason, and exports or cancels', async () => {
    const { app, page } = await launch(data.path);
    try {
      await quickAdd(page, 'goal', 'Semester');

      // The first-launch question is only for the installed app.
      expect(
        await page.getByRole('region', { name: 'Start at login' }).count(),
      ).toBe(0);

      await page.getByText('Settings', { exact: true }).click();
      const toggle = page.getByLabel('Open at Windows login');
      expect(await toggle.isDisabled()).toBe(true);
      await page.getByText('Only available in the installed app').waitFor();

      // Export: stub the native dialog in the main process, then click.
      const target = join(data.path, 'export.json');
      await app.evaluate(({ dialog }, filePath) => {
        dialog.showSaveDialog = (async () => ({
          canceled: false,
          filePath,
        })) as typeof dialog.showSaveDialog;
      }, target);
      await page.getByRole('button', { name: 'Export my data…' }).click();
      await page.getByText(`Exported to ${target}`).waitFor();
      const file = JSON.parse(readFileSync(target, 'utf8'));
      expect(file.format).toBe('productivity-dashboard-export');
      expect(file.goals.map((g: { title: string }) => g.title)).toEqual([
        'Semester',
      ]);

      // Cancelling writes nothing (CA-5.5).
      const other = join(data.path, 'cancelled.json');
      await app.evaluate(({ dialog }) => {
        dialog.showSaveDialog = (async () => ({
          canceled: true,
          filePath: '',
        })) as typeof dialog.showSaveDialog;
      });
      await page.getByRole('button', { name: 'Export my data…' }).click();
      await page.getByText('Export cancelled. Nothing was written.').waitFor();
      expect(existsSync(other)).toBe(false);

      await page.screenshot({ path: 'tests/e2e/last-run-m5.png' });
    } finally {
      await app.close();
    }
  });
});
