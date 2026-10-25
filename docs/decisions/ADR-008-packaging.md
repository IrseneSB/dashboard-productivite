# ADR-008 — Packaging: Electron Forge with a Squirrel installer for Windows

- **Status:** Accepted (2026-10-25), milestone 6

## Context

The app must install like a normal Windows program, start at login (ADR-007), and be easy to
update later. The owner is a student: no paid code-signing certificate, no admin rights required.

## Options considered

| Option                              | Install                                                          | Updates                                            | Notes                                 |
| ----------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------- |
| **Squirrel (Electron Forge maker)** | Per user in `%LOCALAPPDATA%`, no admin rights, shortcuts created | Built-in update framework, keeps a stable launcher | Default Forge maker for Windows       |
| MSI (WiX)                           | Per machine, usually admin rights                                | Manual                                             | Extra tooling (WiX, VBScript feature) |
| ZIP only                            | Unzip and run                                                    | Manual                                             | No shortcuts, no uninstall entry      |

## Decision

- Squirrel installer (`ProductivityDashboardSetup.exe`) as the main artifact, plus a ZIP of the
  same build for quick manual tests. Linux and macOS makers removed: Windows is the target.
- `executableName: productivity-dashboard`; Squirrel package name `productivity_dashboard`.
- Electron fuses (from the template) stay on: the packaged app refuses `ELECTRON_RUN_AS_NODE`,
  Node CLI inspect flags and code outside its `asar` archive.

## Verified (2026-10-25)

- `npm run make` produced the installer (147.9 MB) and the ZIP.
- Running the installer installed the app in `%LOCALAPPDATA%\productivity_dashboard` with
  `Update.exe`, the versioned folder `app-0.1.0` and the launcher one folder up, and opened the
  window titled "Productivity Dashboard".

## Not verified / limitations

- No code signing: SmartScreen may show "Windows protected your PC" on other computers.
- Updates (Squirrel's update feed) are not configured; a new version is installed by running the
  new Setup.exe.
- Because the fuses disable the inspector, Playwright cannot drive the installed app; the
  end-to-end tests run the unpackaged build.

## Revisit if

The app is distributed beyond the owner's own computers (then: code signing, an update feed).
