# ADR-006 — "What should I work on now?": fixed, explainable rules

- **Status:** Accepted (2026-10-25), milestone 4

## Context

The owner wants the app to answer "what should I work on right now?", and asked explicitly for
transparent rules rather than an AI recommendation engine in the first version.

## Options considered

| Option                                            | For                                                                       | Against                                                                             |
| ------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **Ordered rules (lexicographic sort)**            | Each decision can be explained in one sentence; easy to test rule by rule | Cannot weigh "a bit late but very important" against "on time but urgent"           |
| Weighted score (e.g. 3 × lateness + 2 × priority) | Blends factors                                                            | The weights are arbitrary and the result is hard to explain ("why 7.4?")            |
| AI-based suggestion                               | Could use notes and context                                               | Not explainable, not reproducible, needs a model and network; excluded from the MVP |

## Decision

Ordered rules, each one only breaking the ties of the previous one (`src/domain/next-task.ts`):

1. Candidates: open, not blocked, visible tasks. A parent with open subtasks is replaced by its
   subtasks. Tasks in a project marked completed (or a goal marked achieved) are not suggested.
2. Overdue first, most days late first.
3. Then due within 3 days, soonest first.
4. Then priority (high, medium, low).
5. Then the earliest due date; no date last.
6. Then the oldest task, then the title (stable order).

The card shows the suggestion, the reasons that apply to it, and two alternatives. Only facts the
rules actually use are given as reasons.

## Consequences

- A high-priority task with no deadline is suggested after any task due within 3 days, even a
  low-priority one. This is intended (deadlines first) and visible in the explanation.
- The explanation shown under the card comes from `RULES` in the same file, so it cannot drift
  from the code unnoticed (a test checks one sentence per rule).

## Revisit if

The owner often skips the suggestion: record which tasks they pick instead and adjust the rules
(or their order) with that evidence.
