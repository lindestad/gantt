import { useEffect, useState } from 'react'
import { createProject, listProjects } from '../api'
import type { Project } from '../types'

export default function TopBar({ project, setProject }:{ project: Project|null, setProject: (p: Project)=>void }) {
  const [projects, setProjects] = useState<Project[]>([])
  const [name, setName] = useState('')

  useEffect(() => {
    listProjects().then(setProjects)
  }, [])

  async function addProject() {
    if (!name.trim()) return
    const p = await createProject(name.trim())
    setName('')
    setProjects(prev => [p, ...prev])
    setProject(p)
  }

  return (
    <div className="panel flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="text-lg font-semibold">Open Gantt</div>
        <div className="text-slate-500 hidden sm:block">— collaborative Gantt for student orgs</div>
      </div>
      <div className="flex items-center gap-2">
        <select
          className="btn"
          value={project?.id ?? ''}
          onChange={e => {
            const id = Number(e.target.value)
            const p = projects.find(p => p.id === id)
            if (p) setProject(p)
          }}
        >
          <option value="" disabled>Select project…</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input
          placeholder="New project name"
          className="btn"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <button className="btn btn-primary" onClick={addProject}>Create</button>
      </div>
    </div>
  )
}
