# Evaluation of the AI-assisted development process

This project is also a pilot for a larger system of AI agents. This file records what the process
did well and badly, based on observable results.

## Milestone 1

| Aspect                    | Observation                                                                                                               | Evidence                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Understanding the request | Objective restated and confirmed before coding                                                                            | Planning exchange; `requirements.md` |
| Detecting ambiguity       | 6 design-changing questions asked; 2 answers were ambiguous ("TypeScript", "gauge") and were clarified instead of guessed | D1, D3 in `requirements.md`          |
| Assumptions               | 5 assumptions written down, none presented as confirmed                                                                   | A1–A5                                |
| Architecture boundaries   | `domain/` imports nothing; checked by reading imports (no automated rule yet)                                             | `src/domain/*.ts`                    |
| Testing                   | Tests written alongside the code; the end-to-end test caught a real mismatch between test and design                      | Learning guide, chapter 8            |
| Honest reporting          | Results recorded with the commands that produced them                                                                     | `journal.md`                         |
| Agents used               | One main session did requirements, code, tests and docs. No specialist agent was needed for a slice this size             | —                                    |

## Weaknesses found

- The import rule for `domain/` is not enforced by a tool. **To add:** a lint rule or test.
- A slow network made the setup take much longer than the coding; the process had to work around
  it rather than wait.

## Milestone 2

| Aspect                   | Observation                                                                                                                                                     | Evidence                        |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Assumptions              | 4 new assumptions (A6–A9) written before coding; one (A9) was widened during coding and the document was updated, not silently changed                          | `requirements.md`, `journal.md` |
| Regression detection     | The milestone 1 e2e test caught a change in the UI the same day                                                                                                 | Learning guide, ch. 8           |
| **Independent reviewer** | All 89 + 2 tests were green, yet a separate review pass found 10 issues; 9 were worth fixing, 1 was a high-risk user-facing behavior (one-click cascade cancel) | Learning guide, ch. 8           |
| Traceability             | Every CA-2.x criterion names the test that checks it                                                                                                            | `requirements.md`               |
| Honest reporting         | One behavior (confirmation dialog) is marked as not covered by tests                                                                                            | `journal.md`                    |

**What this says about the agent system:** the reviewer earned its place. Tests verify what was
specified; the reviewer questioned what was _not_ specified (user risk, production-only
behavior, malformed input). The cost was one review pass per milestone, not per change.

## Milestone 3

| Aspect                | Observation                                                                                                                                | Evidence                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| Looking at the result | A screenshot of the real window showed a layout problem that no assertion checked                                                          | `journal.md`                    |
| Anticipating breakage | Duplicate controls (panel + tree) were spotted before the old tests failed                                                                 | `tests/e2e/helpers.ts` (`tree`) |
| Independent reviewer  | 6 findings, including one that only appears in real use (app open past midnight, which start-at-login makes likely)                        | Learning guide, ch. 8           |
| Interruption          | A tool outage stopped the session mid-change; the state was reported honestly (what was applied, what was not, untested) and resumed later | `journal.md`                    |
| Owner involvement     | The owner asked to stop waiting for milestone confirmations; publication still requires explicit approval                                  | —                               |

## Still to evaluate

- Whether requirements stay traced as features are added (M3–M6).
- Whether the owner confirms or rejects assumptions A1–A9.
