// Edit form for a goal, a project or a task, shown as a modal dialog.
// Fields start from the saved values; Save sends only this form's fields, and
// the main process validates them all before saving anything (CA-2.1).

import { useState, type FormEvent } from 'react';
import type { DashboardView } from '../../application/use-cases';
import {
  PRIORITIES,
  type Goal,
  type Project,
  type Task,
} from '../../domain/model';
import type { Result } from '../../shared/api';
import { projectOptions } from '../projectOptions';

const EDITABLE_STATUSES: readonly string[] = ['todo', 'in_progress', 'blocked'];

export type Editing =
  | { kind: 'goal'; item: Goal }
  | { kind: 'project'; item: Project }
  | { kind: 'task'; item: Task };

interface Props {
  editing: Editing;
  dashboard: DashboardView;
  onClose: () => void;
  onSaved: () => void;
}

export function EditDialog({ editing, dashboard, onClose, onSaved }: Props) {
  const { kind, item } = editing;
  const [title, setTitle] = useState(item.title);
  const [text, setText] = useState(
    kind === 'task' ? editing.item.notes : editing.item.description,
  );
  const [successDefinition, setSuccessDefinition] = useState(
    kind === 'goal' ? editing.item.successDefinition : '',
  );
  const [date, setDate] = useState(
    (kind === 'task' ? editing.item.dueDate : editing.item.targetDate) ?? '',
  );
  // Only open statuses are offered here; done and cancelled have their own
  // buttons (checkbox, Cancel, Reopen) with their own rules.
  const [status, setStatus] = useState(
    kind === 'task' ? editing.item.status : 'todo',
  );
  const [priority, setPriority] = useState(
    kind === 'task' ? editing.item.priority : 'medium',
  );
  const [parentId, setParentId] = useState(
    (kind === 'task'
      ? editing.item.projectId
      : kind === 'project'
        ? editing.item.goalId
        : null) ?? '',
  );
  const [error, setError] = useState<string | null>(null);

  const isSubtask = kind === 'task' && editing.item.parentTaskId !== null;
  const projects = projectOptions(dashboard);

  async function save(event: FormEvent) {
    event.preventDefault();
    let result: Result<unknown>;
    if (kind === 'goal') {
      result = await window.api.updateGoal(item.id, {
        title,
        description: text,
        successDefinition,
        targetDate: date || null,
      });
    } else if (kind === 'project') {
      result = await window.api.updateProject(item.id, {
        title,
        description: text,
        targetDate: date || null,
        goalId: parentId || null,
      });
    } else {
      result = await window.api.updateTask(item.id, {
        title,
        notes: text,
        priority,
        dueDate: date || null,
        // A subtask follows its parent; sending its project would be refused.
        ...(isSubtask ? {} : { projectId: parentId || null }),
        // One call: every field, status included, is saved together or not
        // at all (code review, M3).
        ...(status !== editing.item.status ? { status } : {}),
      });
    }
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    onSaved();
  }

  return (
    <div className="overlay">
      <form
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`Edit ${kind}`}
        onSubmit={save}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      >
        <h2>Edit {kind}</h2>

        <label>
          Title
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <label>
          {kind === 'task' ? 'Notes' : 'Description'}
          <textarea
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>

        {kind === 'goal' && (
          <label>
            Definition of success
            <textarea
              rows={2}
              value={successDefinition}
              onChange={(e) => setSuccessDefinition(e.target.value)}
            />
          </label>
        )}

        <label>
          {kind === 'task' ? 'Due date' : 'Target date'}
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>

        {kind === 'task' && EDITABLE_STATUSES.includes(editing.item.status) && (
          <label>
            Status
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
            >
              <option value="todo">To do</option>
              <option value="in_progress">In progress</option>
              <option value="blocked">Blocked</option>
            </select>
          </label>
        )}

        {kind === 'task' && (
          <label>
            Priority
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as typeof priority)}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
        )}

        {kind === 'project' && (
          <label>
            Goal
            <select
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
          </label>
        )}

        {kind === 'task' && !isSubtask && (
          <label>
            Project
            <select
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
          </label>
        )}
        {isSubtask && (
          <p className="muted">A subtask stays in its parent task's project.</p>
        )}

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <div className="dialog-buttons">
          <button type="button" onClick={onClose}>
            Close without saving
          </button>
          <button type="submit" className="primary">
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
