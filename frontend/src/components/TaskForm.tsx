import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { format, addDays } from 'date-fns'
import { createTask } from '../api'
import type { Project } from '../types'

export default function TaskForm({ project }:{ project: Project }) {
  const [title, setTitle] = useState('New task')
  const [start, setStart] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [end, setEnd] = useState(() => format(addDays(new Date(), 1), 'yyyy-MM-dd'))

  const createTaskMutation = useMutation({
    mutationFn: (payload: any) => createTask(project.id, payload),
    onSuccess: () => {
      // task will arrive via websocket 'task_created'
      setTitle('New task')
      setStart(format(new Date(), 'yyyy-MM-dd'))
      setEnd(format(addDays(new Date(), 1), 'yyyy-MM-dd'))
    }
  })

  async function submit() {
    if (createTaskMutation.isPending) return
    createTaskMutation.mutate({ title, start, end, progress: 0 })
  }
  return (
    <div className="panel p-3 flex items-end gap-2">
      <div className="flex flex-col">
        <label className="text-xs text-slate-500">Title</label>
        <input className="btn" value={title} onChange={e=>setTitle(e.target.value)} />
      </div>
      <div className="flex flex-col">
        <label className="text-xs text-slate-500">Start</label>
        <input className="btn" type="date" value={start} onChange={e=>{
          const v = e.target.value
          setStart(v)
          if (end < v) setEnd(v)
        }} />
      </div>
      <div className="flex flex-col">
        <label className="text-xs text-slate-500">End</label>
        <input className="btn" type="date" value={end} min={start} onChange={e=>{
          const v = e.target.value
          if (v < start) { setEnd(start) } else { setEnd(v) }
        }} />
      </div>
  <button className="btn btn-primary" onClick={submit} disabled={createTaskMutation.isPending}>{createTaskMutation.isPending ? 'Adding…' : 'Add task'}</button>
    </div>
  )
}
