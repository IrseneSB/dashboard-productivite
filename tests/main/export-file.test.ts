import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ExportFile } from '../../src/application/use-cases';
import { exportToFile } from '../../src/main/export-file';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'dashboard-export-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const data: ExportFile = {
  format: 'productivity-dashboard-export',
  schemaVersion: 1,
  exportedAt: '2026-10-25T12:00:00.000Z',
  goals: [],
  projects: [],
  tasks: [],
};

const dialogReturning = (result: { canceled: boolean; filePath?: string }) => ({
  showSaveDialog: async () => ({ ...result, filePath: result.filePath ?? '' }),
});

describe('exportToFile (CA-5.5)', () => {
  it('writes the JSON where the user chose, and leaves no temporary file', async () => {
    const target = join(dir, 'my-export.json');
    const result = await exportToFile(
      dialogReturning({ canceled: false, filePath: target }) as never,
      null,
      dir,
      () => data,
    );
    expect(result).toEqual({ saved: true, path: target });
    expect(JSON.parse(readFileSync(target, 'utf8'))).toEqual(data);
    expect(readdirSync(dir)).toEqual(['my-export.json']);
  });

  it('writes nothing when the user cancels', async () => {
    const result = await exportToFile(
      dialogReturning({ canceled: true }) as never,
      null,
      dir,
      () => data,
    );
    expect(result).toEqual({ saved: false, path: null });
    expect(readdirSync(dir)).toEqual([]);
  });

  it('proposes a dated file name in the documents folder', async () => {
    let proposed = '';
    const dialog = {
      showSaveDialog: async (options: { defaultPath: string }) => {
        proposed = options.defaultPath;
        return { canceled: true, filePath: '' };
      },
    };
    await exportToFile(dialog as never, null, dir, () => data);
    expect(proposed).toMatch(/productivity-dashboard-\d{4}-\d{2}-\d{2}\.json$/);
    expect(proposed.startsWith(dir)).toBe(true);
    expect(existsSync(proposed)).toBe(false);
  });
});

describe('code review fixes (M5)', () => {
  it('removes the temporary file when writing fails', async () => {
    // A directory with the target's name makes the final rename fail.
    const target = join(dir, 'taken.json');
    const { mkdirSync } = await import('node:fs');
    mkdirSync(target);
    await expect(
      exportToFile(
        dialogReturning({ canceled: false, filePath: target }) as never,
        null,
        dir,
        () => data,
      ),
    ).rejects.toThrow();
    expect(readdirSync(dir)).toEqual(['taken.json']);
  });
});
