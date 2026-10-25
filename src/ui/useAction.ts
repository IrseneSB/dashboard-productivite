// Every user action follows the same pattern: call the main process, show the
// error message if it refused, otherwise reload the dashboard so the screen
// shows what was actually saved. This hook writes that pattern once.

import { createContext, useContext } from 'react';
import type { Result } from '../shared/api';

export type RunAction = (
  call: () => Promise<Result<unknown>>,
) => Promise<boolean>;

export function createRunAction(
  reload: () => Promise<void>,
  setError: (message: string | null) => void,
): RunAction {
  return async (call) => {
    const result = await call();
    if (!result.ok) {
      setError(result.error.message);
      return false;
    }
    setError(null);
    await reload();
    return true;
  };
}

/** Lets nested components run actions without passing callbacks through every level. */
export const ActionContext = createContext<RunAction | null>(null);

export function useRunAction(): RunAction {
  const run = useContext(ActionContext);
  if (!run) throw new Error('useRunAction must be used inside ActionContext');
  return run;
}
