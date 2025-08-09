export type Task = {
  id: number;
  project_id: number;
  title: string;
  start: string; // ISO date
  end: string;   // ISO date
  progress: number; // 0-100
  color?: string;
  lane?: number; // vertical lane index
}

export type Project = {
  id: number;
  name: string;
  start: string; // ISO baseline for chart
}

export type ServerEvent =
  | { type: 'task_created' | 'task_updated' | 'task_deleted', task: Task }
  | { type: 'hydrate', tasks: Task[] }
