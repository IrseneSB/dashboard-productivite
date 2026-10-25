import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createUseCases,
  EXPORT_SCHEMA_VERSION,
} from '../../src/application/use-cases';
import { createMemoryStore } from '../../src/data/memory-store';
import { createSqliteStore, openDatabase } from '../../src/data/sqlite-store';

const now = () => new Date('2026-10-25T12:00:00.000Z');

describe('exportData (CA-5.5)', () => {
  it('contains every goal, project and task, with the schema version', () => {
    let n = 0;
    const app = createUseCases({
      store: createMemoryStore(),
      now,
      newId: () => `id-${++n}`,
    });
    const goal = app.createGoal({ title: 'Semester' });
    const project = app.createProject({ goalId: goal.id, title: 'Quiz' });
    app.createTask({ projectId: project.id, title: 'Study' });
    app.setGoalStatus(goal.id, 'archived'); // archived data is exported too

    const file = app.exportData();
    expect(file).toMatchObject({
      format: 'productivity-dashboard-export',
      schemaVersion: EXPORT_SCHEMA_VERSION,
      exportedAt: '2026-10-25T12:00:00.000Z',
    });
    expect(file.goals.map((g) => [g.title, g.status])).toEqual([
      ['Semester', 'archived'],
    ]);
    expect(file.projects).toHaveLength(1);
    expect(file.tasks.map((t) => t.title)).toEqual(['Study']);
  });
});

describe('first-launch question (CA-5.4)', () => {
  it('is pending once, and stays answered after the app restarts', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dashboard-m5-'));
    try {
      const path = join(dir, 'app.db');
      const first = openDatabase(path);
      const app1 = createUseCases({
        store: createSqliteStore(first),
        now,
        newId: () => 'x',
      });
      expect(app1.getStartupQuestion()).toEqual({ pending: true });
      app1.answerStartupQuestion();
      expect(app1.getStartupQuestion()).toEqual({ pending: false });
      first.close();

      const second = openDatabase(path);
      const app2 = createUseCases({
        store: createSqliteStore(second),
        now,
        newId: () => 'x',
      });
      expect(app2.getStartupQuestion()).toEqual({ pending: false });
      second.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
