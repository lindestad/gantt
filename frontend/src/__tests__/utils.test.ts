import { describe, it, expect } from 'vitest'
import { addOrUpdateTaskUnique, removeTaskById } from '../utils'
import type { Task } from '../types'

const mk = (id: number): Task => ({ id, project_id: 1, title: 't'+id, start: '2025-01-01', end: '2025-01-02', progress: 0 })

describe('utils', () => {
  it('addOrUpdateTaskUnique adds new task', () => {
    const res = addOrUpdateTaskUnique([], mk(1))
    expect(res).toHaveLength(1)
    expect(res[0].id).toBe(1)
  })
  it('addOrUpdateTaskUnique updates existing task by id', () => {
    const res = addOrUpdateTaskUnique([mk(1)], { ...mk(1), title: 'x' })
    expect(res).toHaveLength(1)
    expect(res[0].title).toBe('x')
  })
  it('removeTaskById removes matching id', () => {
    const res = removeTaskById([mk(1), mk(2)], 1)
    expect(res.map(t=>t.id)).toEqual([2])
  })
})
