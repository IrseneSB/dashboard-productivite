import { describe, expect, it } from 'vitest';
import {
  createStartup,
  loginItemTarget,
  StartupError,
  type LoginItemApp,
} from '../../src/main/startup';

const exe =
  'C:\\Users\\me\\AppData\\Local\\productivity\\app-0.1.0\\Productivity Dashboard.exe';
const launcher =
  'C:\\Users\\me\\AppData\\Local\\productivity\\Productivity Dashboard.exe';

/** A fake Windows login-item store, so tests never touch the real registry. */
function fakeApp(isPackaged: boolean, { refuse = false } = {}) {
  const registered = new Map<string, boolean>();
  const app: LoginItemApp = {
    isPackaged,
    getLoginItemSettings: ({ path }) => ({
      openAtLogin: registered.get(path) ?? false,
    }),
    setLoginItemSettings: ({ openAtLogin, path }) => {
      if (!refuse) registered.set(path, openAtLogin);
    },
  };
  return { app, registered };
}

describe('loginItemTarget', () => {
  it("registers Squirrel's launcher one folder up when it exists (survives updates)", () => {
    expect(loginItemTarget(exe, (p) => p === launcher)).toEqual({
      path: launcher,
      args: [],
    });
  });

  it('falls back to the executable itself otherwise', () => {
    expect(loginItemTarget(exe, () => false)).toEqual({ path: exe, args: [] });
  });
});

describe('start at login (CA-5.1, CA-5.2, CA-5.3)', () => {
  it('is unavailable in development and never touches Windows there', () => {
    const { app, registered } = fakeApp(false);
    const startup = createStartup(app, exe);
    expect(startup.getState()).toMatchObject({
      available: false,
      enabled: false,
    });
    expect(startup.getState().reason).toMatch(/installed app/);
    startup.setEnabled(true);
    expect(registered.size).toBe(0);
  });

  it('reports what Windows says after turning it on and off', () => {
    const { app } = fakeApp(true);
    const startup = createStartup(app, exe);
    expect(startup.getState().enabled).toBe(false);
    expect(startup.setEnabled(true)).toEqual({
      available: true,
      enabled: true,
      reason: null,
    });
    expect(startup.setEnabled(false).enabled).toBe(false);
  });

  it('raises a user-facing error when Windows does not accept the change', () => {
    const { app } = fakeApp(true, { refuse: true });
    expect(() => createStartup(app, exe).setEnabled(true)).toThrow(
      StartupError,
    );
  });

  it('rejects anything but true or false', () => {
    const { app } = fakeApp(true);
    expect(() => createStartup(app, exe).setEnabled('yes' as never)).toThrow(
      /true or false/,
    );
  });
});

describe('code review fixes (M5)', () => {
  it('reports "off" when the entry exists but is disabled in Task Manager', () => {
    const app: LoginItemApp = {
      isPackaged: true,
      getLoginItemSettings: () => ({
        openAtLogin: true,
        executableWillLaunchAtLogin: false,
      }),
      setLoginItemSettings: () => {},
    };
    const startup = createStartup(app, exe);
    expect(startup.getState().enabled).toBe(false);
    expect(() => startup.setEnabled(true)).toThrow(/Task Manager/);
  });
});
