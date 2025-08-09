import { useState } from 'react'
import { createTask } from '../api'
import type { Project } from '../types'

export default function TaskForm({ project }:{ project: Project }) {
  const [title, setTitle] = useState('New task')
  const [start, setStart] = useState(() => new Date().toISOString().slice(0,10))
  const [end, setEnd] = useState(() => new Date(Date.now()+86400000).toISOString().slice(0,10))
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (saving) return
    setSaving(true)
    try {
      await createTask(project.id, { title, start, end, progress: 0 })
      // task will arrive via websocket 'task_created'
      setTitle('New task')
      setStart(new Date().toISOString().slice(0,10))
      setEnd(new Date(Date.now()+86400000).toISOString().slice(0,10))
    } finally {
      setSaving(false)
    }
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
  <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Adding…' : 'Add task'}</button>
    </div>
  )
}
