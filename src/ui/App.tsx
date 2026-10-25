// The dashboard screen. Every change goes through runAction, which reloads
// the dashboard from the main process afterwards, so what is shown is always
// what was actually saved.

import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  DashboardView,
  ProjectView,
  TaskView,
} from '../application/use-cases';
import type { Goal, Project, Task } from '../domain/model';
import { EditDialog, type Editing } from './components/EditDialog';
import { Gauge, ProgressBar } from './components/Gauge';
import { QuickAddForm } from './components/QuickAddForm';
import { FocusPanel } from './components/FocusPanel';
import { NextTaskCard } from './components/NextTaskCard';
import { SettingsPanel, StartupQuestion } from './components/SettingsPanel';
import type { StartupState } from '../shared/api';
import { TaskItem } from './components/TaskItem';
import { ActionContext, createRunAction, useRunAction } from './useAction';

export function App() {
  const [dashboard, setDashboard] = useState<DashboardView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [startup, setStartup] = useState<StartupState | null>(null);
  const [askStartup, setAskStartup] = useState(false);

  // Settings are read once at start. The first-launch question only makes
  // sense in the installed app, where the switch actually works.
  useEffect(() => {
    void (async () => {
      const [state, question] = await Promise.all([
        window.api.getStartupState(),
        window.api.getStartupQuestion(),
      ]);
      if (state.ok) setStartup(state.value);
      if (state.ok && question.ok) {
        setAskStartup(state.value.available && question.value.pending);
      }
    })();
  }, []);

  const reload = useCallback(async () => {
    const result = await window.api.getDashboard();
    if (result.ok) {
      setDashboard(result.value);
    } else {
      setError(result.error.message);
    }
  }, []);

  const runAction = useMemo(() => createRunAction(reload, setError), [reload]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // "Overdue" and "Upcoming" depend on today's date. The app may stay open for
  // days (it starts at login), so reload when the window comes back into view
  // and just after each local midnight (code review, M3).
  useEffect(() => {
    const onFocus = () => void reload();
    window.addEventListener('focus', onFocus);
    let timer: ReturnType<typeof setTimeout>;
    const scheduleMidnight = () => {
      const next = new Date();
      next.setHours(24, 0, 5, 0); // 00:00:05 tomorrow, local time
      timer = setTimeout(() => {
        void reload();
        scheduleMidnight();
      }, next.getTime() - Date.now());
    };
    scheduleMidnight();
    return () => {
      window.removeEventListener('focus', onFocus);
      clearTimeout(timer);
    };
  }, [reload]);

  if (!dashboard) {
    return (
      <main className="app">
        {error ? <p role="alert">{error}</p> : <p>Loading…</p>}
      </main>
    );
  }

  const editTask = (task: Task) => setEditing({ kind: 'task', item: task });
  const editProject = (project: Project) =>
    setEditing({ kind: 'project', item: project });
  const editGoal = (goal: Goal) => setEditing({ kind: 'goal', item: goal });

  const isEmpty =
    dashboard.goals.length === 0 &&
    dashboard.standaloneProjects.length === 0 &&
    dashboard.inbox.length === 0;

  return (
    <ActionContext.Provider value={runAction}>
      <main className="app">
        <header className="app-header">
          <h1>Dashboard</h1>
          <SettingsPanel startup={startup} onStartupChange={setStartup} />
        </header>

        {/* Hidden as soon as start at login is on, however it was turned on. */}
        {askStartup && !startup?.enabled && (
          <StartupQuestion
            onAnswered={() => setAskStartup(false)}
            onStartupChange={setStartup}
          />
        )}

        <QuickAddForm dashboard={dashboard} onCreated={reload} />
        {error && (
          <p className="form-error banner" role="alert">
            {error}
          </p>
        )}

        {!isEmpty && <NextTaskCard next={dashboard.next} />}
        {!isEmpty && <FocusPanel focus={dashboard.focus} onEdit={editTask} />}

        {isEmpty && (
          <section className="empty">
            <h2>Start with a long-term goal</h2>
            <p>
              Choose “Goal” above, give it a title, then add a project and a few
              tasks under it.
            </p>
          </section>
        )}

        <div role="region" aria-label="Goals and projects">
          {dashboard.goals.map(({ goal, progress, projects }) => (
            <section key={goal.id} className="goal">
              <div className="goal-header">
                <Gauge
                  progress={progress}
                  label={`Progress of ${goal.title}`}
                />
                <div className="grow">
                  <h2>
                    {goal.title}
                    {goal.status === 'achieved' && (
                      <span className="badge success">achieved</span>
                    )}
                  </h2>
                  {goal.targetDate && (
                    <p className="muted">Target: {goal.targetDate}</p>
                  )}
                  {goal.successDefinition && (
                    <p className="muted">Success: {goal.successDefinition}</p>
                  )}
                  {projects.length === 0 && (
                    <p className="muted">No projects yet.</p>
                  )}
                </div>
                <ItemActions
                  title={goal.title}
                  onEdit={() => editGoal(goal)}
                  toggle={
                    goal.status === 'achieved'
                      ? { label: 'Mark active', status: 'active' }
                      : { label: 'Mark achieved', status: 'achieved' }
                  }
                  setStatus={(status) =>
                    window.api.setGoalStatus(goal.id, status)
                  }
                />
              </div>
              {projects.map((view) => (
                <ProjectCard
                  key={view.project.id}
                  view={view}
                  onEdit={editProject}
                  onEditTask={editTask}
                />
              ))}
            </section>
          ))}

          {dashboard.standaloneProjects.length > 0 && (
            <section className="goal">
              <h2>Projects without a goal</h2>
              {dashboard.standaloneProjects.map((view) => (
                <ProjectCard
                  key={view.project.id}
                  view={view}
                  onEdit={editProject}
                  onEditTask={editTask}
                />
              ))}
            </section>
          )}

          {dashboard.inbox.length > 0 && (
            <section className="goal">
              <h2>Inbox</h2>
              <TaskList tasks={dashboard.inbox} onEdit={editTask} />
            </section>
          )}
        </div>

        <ArchivedSection archived={dashboard.archived} />

        {editing && (
          <EditDialog
            // A new key resets the form when another item is opened.
            key={`${editing.kind}-${editing.item.id}`}
            editing={editing}
            dashboard={dashboard}
            onClose={() => setEditing(null)}
            onSaved={async () => {
              setEditing(null);
              await reload();
            }}
          />
        )}
      </main>
    </ActionContext.Provider>
  );
}

function ProjectCard({
  view,
  onEdit,
  onEditTask,
}: {
  view: ProjectView;
  onEdit: (p: Project) => void;
  onEditTask: (t: Task) => void;
}) {
  const { project } = view;
  return (
    <div className="project">
      <div className="project-header">
        <h3>
          {project.title}
          {project.status === 'completed' && (
            <span className="badge success">completed</span>
          )}
        </h3>
        <ProgressBar progress={view.progress} />
        <ItemActions
          title={project.title}
          onEdit={() => onEdit(project)}
          toggle={
            project.status === 'completed'
              ? { label: 'Mark active', status: 'active' }
              : { label: 'Mark completed', status: 'completed' }
          }
          setStatus={(status) =>
            window.api.setProjectStatus(project.id, status)
          }
        />
      </div>
      {view.tasks.length === 0 ? (
        <p className="muted">No tasks yet.</p>
      ) : (
        <TaskList tasks={view.tasks} onEdit={onEditTask} />
      )}
    </div>
  );
}

function TaskList({
  tasks,
  onEdit,
}: {
  tasks: TaskView[];
  onEdit: (t: Task) => void;
}) {
  return (
    <ul className="tasks">
      {tasks.map((view) => (
        <TaskItem key={view.task.id} view={view} onEdit={onEdit} />
      ))}
    </ul>
  );
}

/** Edit, a status toggle, and Archive, for a goal or a project. */
function ItemActions({
  title,
  onEdit,
  toggle,
  setStatus,
}: {
  title: string;
  onEdit: () => void;
  toggle: { label: string; status: string };
  setStatus: (
    status: string,
  ) => Promise<import('../shared/api').Result<unknown>>;
}) {
  const run = useRunAction();
  return (
    <span className="actions">
      <button
        type="button"
        className="link"
        aria-label={`Edit ${title}`}
        onClick={onEdit}
      >
        Edit
      </button>
      <button
        type="button"
        className="link"
        aria-label={`${toggle.label}: ${title}`}
        onClick={() => run(() => setStatus(toggle.status))}
      >
        {toggle.label}
      </button>
      <button
        type="button"
        className="link"
        aria-label={`Archive ${title}`}
        onClick={() => run(() => setStatus('archived'))}
      >
        Archive
      </button>
    </span>
  );
}

function ArchivedSection({
  archived,
}: {
  archived: DashboardView['archived'];
}) {
  const run = useRunAction();
  if (archived.goals.length === 0 && archived.projects.length === 0)
    return null;
  return (
    <details className="goal archived">
      <summary>
        Archived ({archived.goals.length + archived.projects.length})
      </summary>
      <ul className="tasks">
        {archived.goals.map((goal) => (
          <li key={goal.id} className="task-row">
            <span className="grow">Goal: {goal.title}</span>
            <button
              type="button"
              className="link"
              aria-label={`Restore ${goal.title}`}
              onClick={() =>
                run(() => window.api.setGoalStatus(goal.id, 'active'))
              }
            >
              Restore
            </button>
          </li>
        ))}
        {archived.projects.map((project) => (
          <li key={project.id} className="task-row">
            <span className="grow">Project: {project.title}</span>
            <button
              type="button"
              className="link"
              aria-label={`Restore ${project.title}`}
              onClick={() =>
                run(() => window.api.setProjectStatus(project.id, 'active'))
              }
            >
              Restore
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
