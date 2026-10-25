// Start at Windows login (milestone 5, decision D4).
//
// Windows itself stores the setting (a "login item" in the registry), so the
// app never keeps its own copy: it asks Electron each time. That way the switch
// in Settings can never disagree with what Windows will actually do.

import { existsSync } from 'node:fs';
import path from 'node:path';
import type { StartupState } from '../shared/api';

/** The part of Electron's `app` this module uses, so tests can pass a fake. */
export interface LoginItemApp {
  isPackaged: boolean;
  getLoginItemSettings(options: { path: string; args: string[] }): {
    openAtLogin: boolean;
    /**
     * Windows only: false when the entry exists but was switched off in
     * Task Manager > Startup apps, so Windows will not actually start it.
     */
    executableWillLaunchAtLogin?: boolean;
  };
  setLoginItemSettings(settings: {
    openAtLogin: boolean;
    path: string;
    args: string[];
  }): void;
}

/**
 * Which executable Windows should launch. The Squirrel installer puts each
 * version in its own folder (app-0.1.0\…) and a small launcher one folder up
 * that always starts the newest version; Electron's documentation recommends
 * registering that launcher so the login item survives updates.
 */
export function loginItemTarget(
  execPath: string,
  fileExists: (p: string) => boolean = existsSync,
): { path: string; args: string[] } {
  const launcher = path.resolve(
    path.dirname(execPath),
    '..',
    path.basename(execPath),
  );
  return { path: fileExists(launcher) ? launcher : execPath, args: [] };
}

/**
 * What Windows will really do at the next login. A registry entry disabled in
 * Task Manager still has openAtLogin = true, so the stricter flag wins when
 * Electron provides it (code review, M5).
 */
const willLaunch = (s: {
  openAtLogin: boolean;
  executableWillLaunchAtLogin?: boolean;
}) => s.executableWillLaunchAtLogin ?? s.openAtLogin;

export function createStartup(app: LoginItemApp, execPath: string) {
  const target = () => loginItemTarget(execPath);

  function getState(): StartupState {
    if (!app.isPackaged) {
      return {
        available: false,
        enabled: false,
        reason:
          'Only available in the installed app. A development build would register the wrong program.',
      };
    }
    return {
      available: true,
      enabled: willLaunch(app.getLoginItemSettings(target())),
      reason: null,
    };
  }

  /** Changes the Windows setting, then reads it back: the result is what Windows reports. */
  function setEnabled(enabled: boolean): StartupState {
    if (typeof enabled !== 'boolean') {
      throw new Error('setStartAtLogin expects true or false');
    }
    const state = getState();
    if (!state.available) return state;
    app.setLoginItemSettings({ openAtLogin: enabled, ...target() });
    const after = getState();
    if (after.enabled !== enabled) {
      // Never pretend it worked (CA-5.2).
      throw new StartupError(
        `Windows did not accept the change: the app is still ${after.enabled ? '' : 'not '}set to open at login.` +
          (enabled
            ? ' If it is turned off in Task Manager > Startup apps, turn it on there.'
            : ''),
      );
    }
    return after;
  }

  return { getState, setEnabled };
}

/** A failure the user should see as-is (converted to a Result by ipc.ts). */
export class StartupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StartupError';
  }
}
