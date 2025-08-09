import type { Task } from './types'

export function addOrUpdateTaskUnique(list: Task[], incoming: Task): Task[] {
  const idx = list.findIndex(t => t.id === incoming.id)
  if (idx === -1) return [...list, incoming]
  const next = list.slice()
  next[idx] = incoming
  return next
}

export function removeTaskById(list: Task[], id: number): Task[] {
  return list.filter(t => t.id !== id)
}
