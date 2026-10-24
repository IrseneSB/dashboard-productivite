# ADR-001 — Technology stack: Electron + React + TypeScript

- **Status:** Accepted (2026-10-25)
- **Decided by:** project owner, on the developer's comparison

## Context

We need a real Windows desktop application (not a browser tab) with a flexible interactive UI,
local persistence and automatic start at login. It is a student project: it must be learnable,
maintainable by one person, and reasonably light.

## Options considered

| Criterion                                   | Tauri 2 + React/TS                  | **Electron + React/TS**                     | Python + PySide6              |
| ------------------------------------------- | ----------------------------------- | ------------------------------------------- | ----------------------------- |
| Extra tooling on this machine               | Rust + C++ build tools (several GB) | None (Node.js already installed)            | Python                        |
| App size and memory                         | Small: uses Windows' WebView2       | Larger: ships Chromium + Node.js (~100+ MB) | Medium                        |
| Start at login                              | Official `autostart` plugin         | Built-in `app.setLoginItemSettings`         | Manual registry/shortcut code |
| Local SQLite                                | Official SQL plugin                 | `node:sqlite` built into Node.js            | Built into Python             |
| UI flexibility                              | Web technologies                    | Web technologies                            | Qt widgets                    |
| Languages to learn                          | TypeScript + some Rust              | TypeScript only                             | Python                        |
| Reuse with the owner's other work (Next.js) | High                                | High                                        | Low                           |

## Decision

**Electron + React + TypeScript**, built with Electron Forge and Vite.

## Reasons

- One language everywhere (UI, business rules, persistence, tests): fewer concepts at once.
- Nothing extra to install; the toolchain was available immediately.
- Start at login is a single built-in API call.
- `node:sqlite` removes the need for a native module that must be recompiled for Electron.

## Disadvantages accepted

- Larger installer and higher memory use than Tauri. Acceptable for one app opened at login and
  closed when not needed; we avoid any background process to limit the cost.
- Electron's security model must be configured carefully (context isolation, sandbox,
  no Node.js in the UI). Done in `src/main/main.ts` and `src/preload/preload.ts`.

## Revisit if

- Memory or installer size becomes a real problem for the owner.
- The app must run in the background all day (notifications), where Tauri's lower footprint matters more.
