// Settings (milestone 5): start at Windows login, and "Export my data".
// Also the one-time question shown on first launch of the installed app.

import { useState } from 'react';
import type { StartupState } from '../../shared/api';
import { useRunAction } from '../useAction';

interface Props {
  startup: StartupState | null;
  onStartupChange: (state: StartupState) => void;
}

export function SettingsPanel({ startup, onStartupChange }: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = useRunAction();

  async function toggleStartup(enabled: boolean) {
    setBusy(true);
    const result = await window.api.setStartAtLogin(enabled);
    setBusy(false);
    if (result.ok) {
      onStartupChange(result.value);
      setMessage(
        result.value.enabled
          ? 'The dashboard will open when you log in to Windows.'
          : 'The dashboard will no longer open at login.',
      );
    } else {
      // Reported, never hidden (CA-5.2); run() shows it in the error banner.
      await run(async () => result);
    }
  }

  async function exportData() {
    setBusy(true);
    const result = await window.api.exportToFile();
    setBusy(false);
    if (!result.ok) {
      await run(async () => result); // shows the error in the banner
      return;
    }
    setMessage(
      result.value.saved
        ? `Exported to ${result.value.path}`
        : 'Export cancelled. Nothing was written.',
    );
  }

  return (
    <details className="settings">
      <summary>Settings</summary>
      <label className="switch">
        <input
          type="checkbox"
          checked={startup?.enabled ?? false}
          disabled={!startup?.available || busy}
          onChange={(e) => toggleStartup(e.target.checked)}
        />
        Open at Windows login
      </label>
      {startup && !startup.available && (
        <p className="muted">{startup.reason}</p>
      )}
      <button type="button" disabled={busy} onClick={exportData}>
        Export my data…
      </button>
      {message && (
        <p className="muted" role="status">
          {message}
        </p>
      )}
    </details>
  );
}

/** Asked once, on the first launch of the installed app (CA-5.4, D4). */
export function StartupQuestion({
  onAnswered,
  onStartupChange,
}: {
  onAnswered: () => void;
  onStartupChange: (state: StartupState) => void;
}) {
  const run = useRunAction();

  async function answer(enable: boolean) {
    if (enable) {
      const ok = await run(async () => {
        const result = await window.api.setStartAtLogin(true);
        if (result.ok) onStartupChange(result.value);
        return result;
      });
      // If Windows refused, the error is shown and the question stays.
      if (!ok) return;
    }
    const recorded = await run(() => window.api.answerStartupQuestion());
    if (recorded) onAnswered();
  }

  return (
    <section className="startup-question" aria-label="Start at login">
      <p>
        Open the dashboard automatically when you log in to Windows? You can
        change this later in Settings.
      </p>
      <button type="button" className="primary" onClick={() => answer(true)}>
        Yes, open at login
      </button>
      <button type="button" onClick={() => answer(false)}>
        Not now
      </button>
    </section>
  );
}
