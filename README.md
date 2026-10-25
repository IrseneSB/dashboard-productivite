# Productivity Dashboard

A local-first Windows desktop app that connects **long-term goals → projects → tasks**, shows
progress with a gauge, and (soon) suggests what to work on next. Your data stays on your computer
in a SQLite file.

> **Status: milestone 3 of 6.** You can create, edit, archive and restore goals and projects;
> create, edit, postpone, cancel and complete tasks with one level of subtasks; and see progress.
> A Focus panel shows overdue, upcoming, blocked and recently completed work. The "work on
> next" suggestion, start at login and an installer are not built yet. See [the roadmap](docs/requirements.md#later-mvp-milestones-criteria-written-when-the-milestone-starts).

## Requirements

- Windows 10 or 11
- Node.js 24 or newer, npm 11

## Getting started

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

## Where is my data?

`%APPDATA%\Productivity Dashboard\dashboard.db`. It is never stored in this repository.

## Documentation

- [Requirements and acceptance criteria](docs/requirements.md)
- [Engineering learning guide](docs/learning-guide.md): how and why the app is built this way
- [Architecture decision records](docs/decisions/)
- [Development log](docs/journal.md)

## License

Not chosen yet. `package.json` says MIT (the template default); to be confirmed before publication.
