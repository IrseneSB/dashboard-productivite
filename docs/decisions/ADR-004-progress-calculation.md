# ADR-004 — Progress calculation

- **Status:** Accepted (2026-10-25)

## Context

The owner wants a gauge showing how far a goal or project has progressed. A percentage can
mislead: an empty project shown as 0% looks like a failure, and averaging projects can hide
most of the remaining work.

## Options considered

- **A. Count tasks:** progress = done tasks ÷ tasks that are not cancelled. Simple, explainable.
- **B. Weight by effort:** each task has an effort of 1–3; progress = done effort ÷ total effort.
  More accurate, but one more field to maintain.

## Decision

**Option A**, chosen by the owner. Rules (`src/domain/progress.ts`):

1. Cancelled tasks are removed from the total.
2. No measurable task → the ratio is `null` ("No tasks yet"), never 0%.
3. A goal's progress counts every task of all its projects once. It is **not** the average of
   the projects' percentages: a goal with a 1-task project done and a 3-task project untouched
   is at 1/4 = 25%, not (100% + 0%) / 2 = 50%. A test pins this behavior.
4. The UI always shows the counts next to the gauge ("1 of 4 tasks done") so the number can be checked.

## Consequences

- A five-minute task and a five-hour task weigh the same. The counts next to the gauge make
  this visible.
- Moving to option B later only changes `computeProgress` and adds an `effort` column via a
  new migration; the gauge and its callers do not change.

## Revisit if

The owner finds the gauge misleading in real use (the main signal for option B).
