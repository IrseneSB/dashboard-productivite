// Quick creation of a goal, a project or a task. The UI checks nothing itself
// beyond "required": the main process validates every input and the form
// shows the message it returns.

import { useState, type FormEvent } from 'react';
import type { DashboardView } from '../../application/use-cases';
import { PRIORITIES } from '../../domain/model';
import type { Result } from '../../shared/api';
import { projectOptions } from '../projectOptions';

type Kind = 'goal' | 'project' | 'task';

interface Props {
  dashboard: DashboardView;
  onCreated: () => void;
}

export function QuickAddForm({ dashboard, onCreated }: Props) {
  const [kind, setKind] = useState<Kind>('task');
  const [title, setTitle] = useState('');
  const [parentId, setParentId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('medium');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const projects = projectOptions(dashboard);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    let result: Result<unknown>;
    if (kind === 'goal') {
      result = await window.api.createGoal({ title });
    } else if (kind === 'project') {
      result = await window.api.createProject({
        title,
        goalId: parentId || null,
      });
    } else {
      result = await window.api.createTask({
        title,
        projectId: parentId || null,
        dueDate: dueDate || null,
        priority,
      });
    }
    setSaving(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setTitle('');
    setDueDate('');
    setPriority('medium');
    onCreated();
  }

  return (
    <form className="quick-add" onSubmit={submit}>
      <select
        aria-label="What to create"
        value={kind}
        onChange={(e) => {
          setKind(e.target.value as Kind);
          setParentId('');
        }}
      >
        <option value="goal">Goal</option>
        <option value="project">Project</option>
        <option value="task">Task</option>
      </select>

      <input
        aria-label="Title"
        placeholder={
          kind === 'goal'
            ? 'Long-term goal…'
            : kind === 'project'
              ? 'Project…'
              : 'Task…'
        }
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      {kind === 'project' && (
        <select
          aria-label="Goal"
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
        >
          <option value="">No goal</option>
          {dashboard.goals.map((g) => (
            <option key={g.goal.id} value={g.goal.id}>
              {g.goal.title}
            </option>
          ))}
        </select>
      )}

      {kind === 'task' && (
        <>
          <select
            aria-label="Project"
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
          >
            <option value="">Inbox (no project)</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p} priority
              </option>
            ))}
          </select>
          <input
            aria-label="Due date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </>
      )}

      <button type="submit" disabled={saving}>
        {saving ? 'Saving…' : 'Add'}
      </button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
