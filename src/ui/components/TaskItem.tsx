// One task row: checkbox, title, priority, due date, quick actions, and its
// subtasks underneath. Subtasks use the same component without the
// "add subtask" action (one level only, ADR-005).

import { useState, type FormEvent, type ReactNode } from 'react';
import type { TaskView } from '../../application/use-cases';
import type { Task } from '../../domain/model';
import { useRunAction } from '../useAction';

interface Props {
  view: TaskView;
  onEdit: (task: Task) => void;
}

export function TaskItem({ view, onEdit }: Props) {
  const { task, subtasks, subtaskProgress } = view;
  const run = useRunAction();
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState('');

  async function addSubtask(event: FormEvent) {
    event.preventDefault();
    const ok = await run(() =>
      window.api.createTask({ parentTaskId: task.id, title: subtaskTitle }),
    );
    if (ok) {
      setSubtaskTitle('');
      setAddingSubtask(false);
    }
  }

  return (
    <li className={`task status-${task.status}`}>
      <TaskRow
        task={task}
        onEdit={onEdit}
        openSubtasks={
          subtasks.filter(
            (s) => s.status !== 'done' && s.status !== 'cancelled',
          ).length
        }
        extra={
          <>
            {subtaskProgress && (
              <span className="muted">
                {subtaskProgress.done} of {subtaskProgress.total}{' '}
                {subtaskProgress.total === 1 ? 'subtask' : 'subtasks'}
              </span>
            )}
            {task.status !== 'done' && task.status !== 'cancelled' && (
              <button
                type="button"
                className="link"
                aria-label={`Add subtask to ${task.title}`}
                onClick={() => setAddingSubtask(true)}
              >
                + subtask
              </button>
            )}
          </>
        }
      />

      {(subtasks.length > 0 || addingSubtask) && (
        <ul className="subtasks">
          {subtasks.map((sub) => (
            <li key={sub.id} className={`task status-${sub.status}`}>
              <TaskRow task={sub} onEdit={onEdit} />
            </li>
          ))}
          {addingSubtask && (
            <li>
              <form className="inline-form" onSubmit={addSubtask}>
                <input
                  autoFocus
                  aria-label={`New subtask of ${task.title}`}
                  placeholder="Subtask…"
                  value={subtaskTitle}
                  onChange={(e) => setSubtaskTitle(e.target.value)}
                />
                <button type="submit">Add</button>
                <button
                  type="button"
                  className="link"
                  onClick={() => setAddingSubtask(false)}
                >
                  Close
                </button>
              </form>
            </li>
          )}
        </ul>
      )}
    </li>
  );
}

function TaskRow({
  task,
  onEdit,
  extra,
  openSubtasks = 0,
}: {
  task: Task;
  onEdit: (task: Task) => void;
  extra?: ReactNode;
  /** Open subtasks that cancelling this task would also cancel. */
  openSubtasks?: number;
}) {
  const run = useRunAction();
  const open = task.status !== 'done' && task.status !== 'cancelled';

  return (
    <div className="task-row">
      <label className="task-title">
        <input
          type="checkbox"
          checked={task.status === 'done'}
          disabled={task.status === 'cancelled'}
          onChange={() =>
            run(() =>
              window.api.setTaskStatus(
                task.id,
                task.status === 'done' ? 'todo' : 'done',
              ),
            )
          }
        />
        <span>{task.title}</span>
      </label>
      <span className={`badge priority-${task.priority}`}>{task.priority}</span>
      {task.status === 'cancelled' && <span className="badge">cancelled</span>}
      {task.status === 'blocked' && <span className="badge">blocked</span>}
      {task.dueDate && <span className="muted">due {task.dueDate}</span>}
      {extra}
      <span className="actions">
        {open && (
          <>
            <button
              type="button"
              className="link"
              aria-label={`Postpone ${task.title} by 1 day`}
              onClick={() => run(() => window.api.postponeTask(task.id, 1))}
            >
              +1 day
            </button>
            <button
              type="button"
              className="link"
              aria-label={`Postpone ${task.title} by 1 week`}
              onClick={() => run(() => window.api.postponeTask(task.id, 7))}
            >
              +1 week
            </button>
          </>
        )}
        <button
          type="button"
          className="link"
          aria-label={`Edit ${task.title}`}
          onClick={() => onEdit(task)}
        >
          Edit
        </button>
        {task.status === 'cancelled' ? (
          <button
            type="button"
            className="link"
            aria-label={`Reopen ${task.title}`}
            onClick={() => run(() => window.api.setTaskStatus(task.id, 'todo'))}
          >
            Reopen
          </button>
        ) : (
          open && (
            <button
              type="button"
              className="link danger"
              aria-label={`Cancel ${task.title}`}
              onClick={() => {
                // Cancelling cascades to open subtasks, and reopening the task
                // later does not reopen them: ask first (code review, M2).
                if (
                  openSubtasks > 0 &&
                  !window.confirm(
                    `Cancel "${task.title}" and its ${openSubtasks} open subtask${openSubtasks > 1 ? 's' : ''}?

Reopening the task later will not reopen its subtasks.`,
                  )
                ) {
                  return;
                }
                void run(() => window.api.setTaskStatus(task.id, 'cancelled'));
              }}
            >
              Cancel
            </button>
          )
        )}
      </span>
    </div>
  );
}
