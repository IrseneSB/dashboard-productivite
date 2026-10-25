// Shared helpers for the end-to-end tests: start the built app with a
// throwaway data folder, and fill the quick-add form like a user would.

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  _electron as electron,
  type ElectronApplication,
  type Page,
} from 'playwright';

export function createDataDir(): { path: string; remove: () => void } {
  const path = mkdtempSync(join(tmpdir(), 'dashboard-e2e-'));
  return { path, remove: () => rmSync(path, { recursive: true, force: true }) };
}

export async function launch(
  dataDir: string,
): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await electron.launch({
    args: ['.'],
    env: { ...process.env, DASHBOARD_USER_DATA: dataDir },
  });
  const page = await app.firstWindow();
  await page.getByRole('heading', { name: 'Dashboard' }).waitFor();
  return { app, page };
}

export async function quickAdd(
  page: Page,
  kind: 'goal' | 'project' | 'task',
  title: string,
  options: { parent?: string; priority?: string; dueDate?: string } = {},
) {
  await page.getByLabel('What to create').selectOption(kind);
  await page.getByLabel('Title', { exact: true }).fill(title);
  if (options.parent) {
    const label = kind === 'project' ? 'Goal' : 'Project';
    await page
      .getByLabel(label, { exact: true })
      .selectOption({ label: options.parent });
  }
  if (options.priority) {
    await page.getByLabel('Priority').selectOption(options.priority);
  }
  if (options.dueDate) {
    await page.getByLabel('Due date').fill(options.dueDate);
  }
  await page.getByRole('button', { name: 'Add', exact: true }).click();
}

/**
 * The goals → projects → tasks tree. Since milestone 3 the same task can also
 * appear in the Focus panel, so task controls are looked up inside the tree.
 */
export const tree = (page: Page) =>
  page.getByRole('region', { name: 'Goals and projects' });
