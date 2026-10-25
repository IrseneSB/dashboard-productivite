# ADR-007 — Start at login: a normal window, a Windows login item, no background process

- **Status:** Accepted (2026-10-25), milestone 5. Implements decision D4.

## Context

The owner wants the dashboard to be there when they log in, without remembering to open it.
"Start at login" does not have to mean "run in the background all the time".

## Options considered

| Option                                           | Resource use                  | Complexity                                        | Why (not)                                                  |
| ------------------------------------------------ | ----------------------------- | ------------------------------------------------- | ---------------------------------------------------------- |
| **Open the normal window at login (login item)** | Only while the window is open | One Electron API                                  | Matches the need: see the dashboard when the day starts    |
| Start hidden in the system tray                  | Always running                | Tray icon, menu, hide/show logic, single instance | Only useful for reminders, which are excluded from the MVP |
| Background service + notifications               | Always running                | Much higher                                       | Excluded from the MVP (requirements, "Excluded")           |

## Decision

- Use Electron's `app.setLoginItemSettings({ openAtLogin, path, args })`. Windows stores it in
  the user's login items (registry), not the app: **Windows is the source of truth**, and the
  app reads it back each time instead of keeping its own copy.
- Register Squirrel's launcher one folder above the versioned executable, as Electron's
  documentation recommends, so the login item keeps working after an update.
- Read `executableWillLaunchAtLogin` when Electron provides it: an entry disabled in Task Manager
  still has `openAtLogin = true` but will not start.
- **Disabled in development** (`app.isPackaged === false`): a development build would register
  `electron.exe` from `node_modules`, which is not the app.
- Ask once on the first launch of the installed app; "Not now" is remembered in the `settings`
  table (migration 3). The choice can always be changed in Settings.
- If Windows does not accept the change, the app says so; it never shows a switch that disagrees
  with Windows.

## Consequences

- Development builds cannot test the real login item; it is verified on the installed app
  (milestone 6) and by unit tests with a fake Windows (`tests/main/startup.test.ts`).
- **Not yet verified on a real Windows install:** the Squirrel launcher path and the Task Manager
  behavior of `executableWillLaunchAtLogin`.

## Revisit if

Reminders or notifications are added (they would need the app running in the background, and a
tray icon would then make sense).
