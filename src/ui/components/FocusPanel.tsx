// "Focus" area at the top of the dashboard (milestone 3): overdue, upcoming,
// blocked and recently completed work. Each item says where it belongs and
// keeps the usual task actions, so it can be handled without scrolling.

import type { ReactNode } from 'react';
import {
  RECENT_DAYS,
  UPCOMING_DAYS,
  type FocusItem,
  type FocusSections,
} from '../../domain/focus';
import type { Task } from '../../domain/model';
import { TaskRow } from './TaskItem';

interface Props {
  focus: FocusSections;
  onEdit: (task: Task) => void;
}

export function FocusPanel({ focus, onEdit }: Props) {
  return (
    <section className="focus" aria-label="Focus">
      <FocusList
        title="Overdue"
        empty="Nothing overdue."
        items={focus.overdue}
        onEdit={onEdit}
        detail={(item) =>
          'daysLate' in item &&
          `${item.daysLate} day${item.daysLate === 1 ? '' : 's'} late`
        }
        tone="danger"
      />
      <FocusList
        title={`Upcoming (${UPCOMING_DAYS} days)`}
        empty={`Nothing due in the next ${UPCOMING_DAYS} days.`}
        items={focus.upcoming}
        onEdit={onEdit}
        detail={(item) =>
          'daysLeft' in item &&
          (item.daysLeft === 0
            ? 'today'
            : item.daysLeft === 1
              ? 'tomorrow'
              : `in ${item.daysLeft} days`)
        }
      />
      <FocusList
        title="Blocked"
        empty="Nothing blocked."
        items={focus.blocked}
        onEdit={onEdit}
      />
      <FocusList
        title="Recently completed"
        empty={`Nothing completed in the last ${RECENT_DAYS} days.`}
        items={focus.recentlyCompleted}
        onEdit={onEdit}
      />
    </section>
  );
}

function FocusList<T extends FocusItem>({
  title,
  empty,
  items,
  onEdit,
  detail,
  tone,
}: {
  title: string;
  empty: string;
  items: T[];
  onEdit: (task: Task) => void;
  detail?: (item: T) => ReactNode;
  tone?: 'danger';
}) {
  return (
    <div className={`focus-list ${tone ?? ''}`}>
      <h2>
        {title} <span className="count">{items.length}</span>
      </h2>
      {items.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <ul className="tasks">
          {items.map((item) => (
            <li
              key={item.task.id}
              className={`task status-${item.task.status}`}
            >
              <TaskRow
                task={item.task}
                onEdit={onEdit}
                compact
                extra={detail && <span className="when">{detail(item)}</span>}
              />
              <div className="context muted">
                {item.context.length === 0 ? 'Inbox' : item.context.join(' › ')}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
