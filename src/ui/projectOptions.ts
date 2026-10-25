// The list of projects a task can be placed in, labelled with their goal.
// Used by every project picker so they always offer the same choices.

import type { DashboardView } from '../application/use-cases';
import type { Id } from '../domain/model';

export interface ProjectOption {
  id: Id;
  label: string;
}

export function projectOptions(dashboard: DashboardView): ProjectOption[] {
  return [
    ...dashboard.goals.flatMap((g) =>
      g.projects.map((p) => ({
        id: p.project.id,
        label: `${g.goal.title} › ${p.project.title}`,
      })),
    ),
    ...dashboard.standaloneProjects.map((p) => ({
      id: p.project.id,
      label: p.project.title,
    })),
  ];
}
