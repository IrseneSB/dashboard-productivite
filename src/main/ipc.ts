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
  // Every API function has a use case with the same name and arguments, so one
  // loop registers them all; adding a use case to DashboardApi and CHANNELS is
  // enough to expose it. Arguments arrive from the renderer untyped: the use
  // cases validate them before use.
  for (const name of Object.keys(CHANNELS) as (keyof typeof CHANNELS)[]) {
    const useCase = useCases[name] as (...args: unknown[]) => unknown;
    ipcMain.handle(CHANNELS[name], (_event, ...args: unknown[]) =>
      toResult(() => useCase(...args)),
    );
  }
}
