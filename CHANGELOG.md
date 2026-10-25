# Changelog

All notable changes. Versions follow [Semantic Versioning](https://semver.org/):
MAJOR for changes that break existing data or behavior, MINOR for new features, PATCH for fixes.

## 0.1.0 — 2026-10-25 (first release candidate, not published yet)

### Added

- Goals, projects and tasks, with one level of subtasks; Inbox for tasks without a project.
- Progress gauge per goal and bar per project (every task counts the same, ADR-004).
- Edit, archive and restore goals and projects; edit, postpone (+1 day, +1 week), cancel,
  reopen and complete tasks.
- Focus panel: overdue, upcoming (7 days), blocked, recently completed.
- "What should I work on now?" suggestion with its reasons and two alternatives (ADR-006).
- Start at Windows login (installed app only, ADR-007) and a one-time question on first launch.
- Export of all data to a JSON file.
- Windows installer (Squirrel, per-user, no admin rights).

### Known limitations

- Installer size about 148 MB (Electron ships its own browser engine, ADR-001).
- No import yet: an export cannot be restored from the app.
- No notifications or reminders (excluded from the MVP).
- The installer is not code-signed: Windows SmartScreen may warn on first run.
