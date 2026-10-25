# Productivity Dashboard

A local-first Windows desktop app that connects **long-term goals → projects → tasks**, shows
progress with a gauge, and suggests what to work on next. Your data stays on your computer
in a SQLite file.

> **Status: all 6 milestones built (version 0.1.0, not published yet).** You can create, edit, archive and restore goals and projects;
> create, edit, postpone, cancel and complete tasks with one level of subtasks; and see progress.
> A Focus panel shows overdue, upcoming, blocked and recently completed work. A card suggests
> what to work on next, with its reasons. Settings offer start at login
> (installed app only) and a JSON export. A Windows installer is built with
> `npm run make`. See [CHANGELOG.md](CHANGELOG.md) for known limitations. See [the roadmap](docs/requirements.md#later-mvp-milestones-criteria-written-when-the-milestone-starts).

## Requirements

- Windows 10 or 11
- Node.js 24 or newer, npm 11

## Install (Windows)

Run `ProductivityDashboardSetup.exe` (from `npm run make`, in `out/make/squirrel.windows/x64/`,
or from a GitHub release). It installs for your user only, without admin rights, and opens the
app. The installer is not code-signed, so Windows SmartScreen may ask for confirmation.

To uninstall: Windows Settings → Apps → Productivity Dashboard. Your data stays in
`%APPDATA%Productivity Dashboard` until you delete that folder.

## Getting started (development)

```bash
npm install
npm start
```

## Development commands

| Command            | What it does                                                   |
| ------------------ | -------------------------------------------------------------- |
| `npm start`        | Runs the app in development mode                               |
| `npm run verify`   | Type check, lint, format check, unit and integration tests     |
| `npm run test:e2e` | Builds the app and runs the end-to-end test in the real window |
| `npm run lint:fix` | Fixes lint and formatting issues                               |
| `npm run package`  | Builds the app into `out/`                                     |
| `npm run make`     | Builds the Windows installer and a ZIP into `out/make/`        |

## Where is my data?

`%APPDATA%\Productivity Dashboard\dashboard.db`. It is never stored in this repository.

## Documentation

- [Requirements and acceptance criteria](docs/requirements.md)
- [Engineering learning guide](docs/learning-guide.md): how and why the app is built this way
- [Architecture decision records](docs/decisions/)
- [Development log](docs/journal.md)

## License

Not chosen yet. `package.json` says MIT (the template default); to be confirmed before publication.
