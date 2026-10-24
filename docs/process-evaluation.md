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

## To evaluate in later milestones

- Whether an independent reviewer finds issues the main session missed (planned at the end of M2).
- Whether requirements stay traced as features are added.
