// Registers one IPC handler per API function. This file is the only place
// where the main process listens to the renderer, so it is also where every
// input coming from the UI is treated as untrusted and every error is
// converted into a Result.

import { ipcMain } from 'electron';
import { ValidationError } from '../domain/validation';
import { CHANNELS, type DashboardApi, type Result } from '../shared/api';
import { StartupError } from './startup';

/** Errors whose message is written for the user and can be shown as-is. */
const isUserFacing = (
  error: unknown,
): error is ValidationError | StartupError =>
  error instanceof ValidationError || error instanceof StartupError;

async function toResult<T>(run: () => T | Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    if (isUserFacing(error)) {
      return {
        ok: false,
        error: {
          field: error instanceof ValidationError ? error.field : null,
          message: error.message,
        },
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

/**
 * One function per API method, with the same name: the use cases, plus the
 * few operations that need the operating system (login item, save dialog).
 */
export type Handlers = {
  [K in keyof DashboardApi]: (...args: never[]) => unknown;
};

export function registerIpcHandlers(handlers: Handlers): void {
  // One loop registers them all; adding a function to DashboardApi, CHANNELS
  // and the handlers is enough to expose it. Arguments arrive from the
  // renderer untyped: each handler validates them before use.
  for (const name of Object.keys(CHANNELS) as (keyof typeof CHANNELS)[]) {
    const handler = handlers[name] as (...args: unknown[]) => unknown;
    ipcMain.handle(CHANNELS[name], (_event, ...args: unknown[]) =>
      toResult(() => handler(...args)),
    );
  }
}
