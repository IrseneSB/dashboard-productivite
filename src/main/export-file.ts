// "Export my data" (milestone 5, A3): ask where to save, then write the JSON
// produced by the exportData use case. The file is written next to its final
// name first and renamed at the end, so an interrupted write never leaves a
// half-written export with the real name.

import { renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { BrowserWindow, Dialog } from 'electron';
import type { ExportFile } from '../application/use-cases';
import { localIsoDate } from '../domain/dates';
import type { ExportResult } from '../shared/api';

export async function exportToFile(
  dialog: Pick<Dialog, 'showSaveDialog'>,
  window: BrowserWindow | null,
  documentsDir: string,
  data: () => ExportFile,
): Promise<ExportResult> {
  const defaultPath = path.join(
    documentsDir,
    `productivity-dashboard-${localIsoDate(new Date())}.json`,
  );
  const options = {
    title: 'Export my data',
    defaultPath,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  };
  const choice = window
    ? await dialog.showSaveDialog(window, options)
    : await dialog.showSaveDialog(options);
  if (choice.canceled || !choice.filePath) {
    return { saved: false, path: null }; // Cancelling writes nothing (CA-5.5).
  }
  const tmp = `${choice.filePath}.tmp`;
  try {
    writeFileSync(tmp, JSON.stringify(data(), null, 2), 'utf8');
    renameSync(tmp, choice.filePath);
  } catch (error) {
    // Never leave a partial copy of personal data behind (code review, M5).
    rmSync(tmp, { force: true });
    throw error;
  }
  return { saved: true, path: choice.filePath };
}
