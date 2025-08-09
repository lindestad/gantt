import { useState } from 'react'
import { createTask } from '../api'
import type { Project, Task } from '../types'

export default function TaskForm({ project, onCreated }:{ project: Project, onCreated: (t: Task)=>void }) {
  const [title, setTitle] = useState('New task')
  const [start, setStart] = useState(() => new Date().toISOString().slice(0,10))
  const [end, setEnd] = useState(() => new Date(Date.now()+86400000).toISOString().slice(0,10))

  async function submit() {
    const t = await createTask(project.id, { title, start, end, progress: 0 })
    onCreated(t)
  }
  return (
    <div className="panel p-3 flex items-end gap-2">
      <div className="flex flex-col">
        <label className="text-xs text-slate-500">Title</label>
        <input className="btn" value={title} onChange={e=>setTitle(e.target.value)} />
      </div>
      <div className="flex flex-col">
        <label className="text-xs text-slate-500">Start</label>
        <input className="btn" type="date" value={start} onChange={e=>setStart(e.target.value)} />
      </div>
      <div className="flex flex-col">
        <label className="text-xs text-slate-500">End</label>
        <input className="btn" type="date" value={end} onChange={e=>setEnd(e.target.value)} />
      </div>
      <button className="btn btn-primary" onClick={submit}>Add task</button>
    </div>
  )
}
