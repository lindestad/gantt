const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export async function listProjects() {
  const res = await fetch(`${BASE}/projects`);
  return res.json();
}

export async function createProject(name: string) {
  const res = await fetch(`${BASE}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });
  return res.json();
}

export async function listTasks(projectId: number) {
  const res = await fetch(`${BASE}/projects/${projectId}/tasks`);
  return res.json();
}

export async function createTask(projectId: number, payload: any) {
  const res = await fetch(`${BASE}/projects/${projectId}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res.json();
}

export async function updateTask(projectId: number, id: number, payload: any) {
  const res = await fetch(`${BASE}/projects/${projectId}/tasks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res.json();
}

export async function deleteTask(projectId: number, id: number) {
  await fetch(`${BASE}/projects/${projectId}/tasks/${id}`, { method: 'DELETE' });
}

export function wsUrl(projectId: number) {
  const url = new URL(BASE);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = `/ws/projects/${projectId}`;
  return url.toString();
}
