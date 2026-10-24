// Milestone 1 dashboard: goals with their gauge, projects with a bar, tasks
// with a checkbox. Every change reloads the dashboard from the main process,
// so what is shown is always what was actually saved.

import { useCallback, useEffect, useState } from 'react';
import type { DashboardView, ProjectView } from '../application/use-cases';
import type { Task } from '../domain/model';
import { Gauge, ProgressBar } from './components/Gauge';
import { QuickAddForm } from './components/QuickAddForm';

export function App() {
  const [dashboard, setDashboard] = useState<DashboardView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const result = await window.api.getDashboard();
    if (result.ok) {
      setDashboard(result.value);
      setError(null);
    } else {
      setError(result.error.message);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function toggle(task: Task) {
    const result = await window.api.setTaskStatus(
      task.id,
      task.status === 'done' ? 'todo' : 'done',
    );
    if (!result.ok) setError(result.error.message);
    await reload();
  }

  if (!dashboard) {
    return (
      <main className="app">
        {error ? <p role="alert">{error}</p> : <p>Loading…</p>}
      </main>
    );
  }

  const isEmpty =
    dashboard.goals.length === 0 &&
    dashboard.standaloneProjects.length === 0 &&
    dashboard.inbox.length === 0;

  return (
    <main className="app">
      <header>
        <h1>Dashboard</h1>
      </header>

      <QuickAddForm dashboard={dashboard} onCreated={reload} />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {isEmpty && (
        <section className="empty">
          <h2>Start with a long-term goal</h2>
          <p>
            Choose “Goal” above, give it a title, then add a project and a few
            tasks under it.
          </p>
        </section>
      )}

      {dashboard.goals.map(({ goal, progress, projects }) => (
        <section key={goal.id} className="goal">
          <div className="goal-header">
            <Gauge progress={progress} label={`Progress of ${goal.title}`} />
            <div>
              <h2>{goal.title}</h2>
              {goal.targetDate && (
                <p className="muted">Target: {goal.targetDate}</p>
              )}
              {projects.length === 0 && (
                <p className="muted">No projects yet.</p>
              )}
            </div>
          </div>
          {projects.map((view) => (
            <ProjectCard key={view.project.id} view={view} onToggle={toggle} />
          ))}
        </section>
      ))}

      {dashboard.standaloneProjects.length > 0 && (
        <section className="goal">
          <h2>Projects without a goal</h2>
          {dashboard.standaloneProjects.map((view) => (
            <ProjectCard key={view.project.id} view={view} onToggle={toggle} />
          ))}
        </section>
      )}

      {dashboard.inbox.length > 0 && (
        <section className="goal">
          <h2>Inbox</h2>
          <TaskList tasks={dashboard.inbox} onToggle={toggle} />
        </section>
      )}
    </main>
  );
}

function ProjectCard({
  view,
  onToggle,
}: {
  view: ProjectView;
  onToggle: (t: Task) => void;
}) {
  return (
    <div className="project">
      <div className="project-header">
        <h3>{view.project.title}</h3>
        <ProgressBar progress={view.progress} />
      </div>
      {view.tasks.length === 0 ? (
        <p className="muted">No tasks yet.</p>
      ) : (
        <TaskList tasks={view.tasks} onToggle={onToggle} />
      )}
    </div>
  );
}

function TaskList({
  tasks,
  onToggle,
}: {
  tasks: Task[];
  onToggle: (t: Task) => void;
}) {
  return (
    <ul className="tasks">
      {tasks.map((task) => (
        <li
          key={task.id}
          className={task.status === 'done' ? 'done' : undefined}
        >
          <label>
            <input
              type="checkbox"
              checked={task.status === 'done'}
              onChange={() => onToggle(task)}
            />
            <span>{task.title}</span>
          </label>
          {task.dueDate && <span className="muted">due {task.dueDate}</span>}
        </li>
      ))}
    </ul>
  );
}
