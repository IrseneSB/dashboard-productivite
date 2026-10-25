// "What should I work on now?" card (milestone 4). Shows the suggested task,
// why it was chosen, two alternatives, and the two actions that matter here:
// start it, or mark it done.

import { useState } from 'react';
import { RULES, type NextTask, type Suggestion } from '../../domain/next-task';
import { useRunAction } from '../useAction';

export function NextTaskCard({ next }: { next: NextTask }) {
  const run = useRunAction();
  const { suggestion, alternatives, emptyReason } = next;
  // Disabled while saving: a double click must not complete the NEXT
  // suggestion, which the user has not read yet (code review, M4).
  const [busy, setBusy] = useState(false);
  const act = async (status: string) => {
    if (!suggestion || busy) return;
    setBusy(true);
    try {
      await run(() =>
        window.api.setTaskStatus(suggestion.item.task.id, status),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="next-task" aria-label="Work on next">
      <h2>What should I work on now?</h2>
      {suggestion === null ? (
        <p className="muted">{emptyReason}</p>
      ) : (
        <>
          <SuggestionLine suggestion={suggestion} main />
          <div className="next-actions">
            {suggestion.item.task.status !== 'in_progress' && (
              <button
                type="button"
                disabled={busy}
                onClick={() => act('in_progress')}
              >
                Start
              </button>
            )}
            <button
              type="button"
              className="primary"
              disabled={busy}
              onClick={() => act('done')}
            >
              Mark done
            </button>
          </div>
          {alternatives.length > 0 && (
            <div className="alternatives">
              <h3>Or</h3>
              <ul>
                {alternatives.map((alt) => (
                  <li key={alt.item.task.id}>
                    <SuggestionLine suggestion={alt} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="muted rule-note">
            Chosen by fixed rules: {RULES.join(', ')}.
          </p>
        </>
      )}
    </section>
  );
}

function SuggestionLine({
  suggestion,
  main = false,
}: {
  suggestion: Suggestion;
  main?: boolean;
}) {
  const { item, reasons } = suggestion;
  return (
    <div className={main ? 'suggestion main' : 'suggestion'}>
      <span className="suggestion-title">
        {item.task.title}
        {item.task.status === 'in_progress' && (
          <span className="badge">in progress</span>
        )}
      </span>
      <span className="muted">
        {' '}
        — {reasons.join(', ')} ·{' '}
        {item.context.length === 0 ? 'Inbox' : item.context.join(' › ')}
      </span>
    </div>
  );
}
