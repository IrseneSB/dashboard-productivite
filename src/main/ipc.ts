// Registers one IPC handler per use case. This file is the only place where
// the main process listens to the renderer, so it is also where every input
// coming from the UI is treated as untrusted and every error is converted
// into a Result.

import { ipcMain } from 'electron';
import type { UseCases } from '../application/use-cases';
import { ValidationError } from '../domain/validation';
import { CHANNELS, type Result } from '../shared/api';

function toResult<T>(run: () => T): Result<T> {
  try {
    return { ok: true, value: run() };
  } catch (error) {
    if (error instanceof ValidationError) {
      return {
        ok: false,
        error: { field: error.field, message: error.message },
      };
    }
    // Unexpected failure (bug, disk error...): keep the details in the log,
    // show the user a message that does not pretend to know the cause.
    console.error('[ipc] unexpected error', error);
    return {
      ok: false,
      error: {
        field: null,
        message: 'Something went wrong. The details were written to the log.',
      },
    };
  }
}

export function registerIpcHandlers(useCases: UseCases): void {
  ipcMain.handle(CHANNELS.getDashboard, () =>
    toResult(() => useCases.getDashboard()),
  );
  ipcMain.handle(CHANNELS.createGoal, (_event, input) =>
    toResult(() => useCases.createGoal(input)),
  );
  ipcMain.handle(CHANNELS.createProject, (_event, input) =>
    toResult(() => useCases.createProject(input)),
  );
  ipcMain.handle(CHANNELS.createTask, (_event, input) =>
    toResult(() => useCases.createTask(input)),
  );
  ipcMain.handle(CHANNELS.setTaskStatus, (_event, taskId, status) =>
    toResult(() => useCases.setTaskStatus(taskId, status)),
  );
}
