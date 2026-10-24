// Half-circle gauge for a goal's progress, with the real counts underneath
// so the percentage can always be checked ("7 of 12 tasks").

import type { Progress } from '../../domain/progress';

const RADIUS = 52;
const ARC_LENGTH = Math.PI * RADIUS; // length of a half circle

export function Gauge({
  progress,
  label,
}: {
  progress: Progress;
  label: string;
}) {
  const ratio = progress.ratio ?? 0;
  const percent = Math.round(ratio * 100);
  return (
    <figure className="gauge" aria-label={label}>
      <svg viewBox="0 0 120 70" role="img" aria-hidden="true">
        <path className="gauge-track" d="M 8 62 A 52 52 0 0 1 112 62" />
        {progress.ratio !== null && (
          <path
            className="gauge-fill"
            d="M 8 62 A 52 52 0 0 1 112 62"
            // Draws only the first `ratio` part of the arc.
            strokeDasharray={`${ratio * ARC_LENGTH} ${ARC_LENGTH}`}
          />
        )}
        <text x="60" y="58" textAnchor="middle" className="gauge-value">
          {progress.ratio === null ? '–' : `${percent}%`}
        </text>
      </svg>
      <figcaption>
        {progress.total === 0
          ? 'No tasks yet'
          : `${progress.done} of ${progress.total} task${progress.total > 1 ? 's' : ''} done`}
      </figcaption>
    </figure>
  );
}

/** Compact bar for projects, where a full gauge would take too much room. */
export function ProgressBar({ progress }: { progress: Progress }) {
  const percent = Math.round((progress.ratio ?? 0) * 100);
  return (
    <div className="bar" title={`${progress.done}/${progress.total}`}>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${percent}%` }} />
      </div>
      <span className="bar-label">
        {progress.total === 0
          ? 'No tasks'
          : `${progress.done}/${progress.total}`}
      </span>
    </div>
  );
}
