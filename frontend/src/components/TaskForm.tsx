import { useState } from 'react'
import { createTask } from '../api'
import type { Project, Task } from '../types'

export default function TaskForm({ project, onCreated, existingTasks = [] as Task[] }:{ project: Project, onCreated: (t: Task)=>void, existingTasks?: Task[] }) {
  const [title, setTitle] = useState('New task')
  const [start, setStart] = useState(() => new Date().toISOString().slice(0,10))
  const [end, setEnd] = useState(() => new Date(Date.now()+86400000).toISOString().slice(0,10))
  const [deps, setDeps] = useState<number[]>([])

  async function submit() {
    const t = await createTask(project.id, { title, start, end, progress: 0, dependencies: deps })
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
      <div className="flex flex-col">
        <label className="text-xs text-slate-500">Depends on</label>
        <select multiple className="btn min-w-40" value={deps.map(String)} onChange={(e)=>{
          const values = Array.from(e.target.selectedOptions).map(o=>Number(o.value))
          setDeps(values)
        }}>
          {existingTasks.map(t => (
            <option key={t.id} value={t.id}>{t.title}</option>
          ))}
        </select>
      </div>
      <button className="btn btn-primary" onClick={submit}>Add task</button>
    </div>
  )
}
