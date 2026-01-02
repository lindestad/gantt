import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createProject, fetchProjects } from '../api'
import type { Project } from '../types'

export default function TopBar({ project, setProject }:{ project: Project|null, setProject: (p: Project)=>void }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [isDark, setIsDark] = useState<boolean>(()=>{
    return typeof window !== 'undefined' && document.documentElement.classList.contains('dark')
  })

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects
  })

  const createProjectMutation = useMutation({
    mutationFn: createProject,
    onSuccess: (newProject) => {
      queryClient.setQueryData(['projects'], (old: Project[] = []) => [newProject, ...old])
      setProject(newProject)
      setName('')
    }
  })

  async function addProject() {
    if (!name.trim()) return
    createProjectMutation.mutate(name.trim())
  }

  return (
    <div className="panel flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="text-lg font-semibold">Open Gantt</div>
        <div className="text-slate-500 hidden sm:block">— collaborative Gantt for student orgs</div>
      </div>
      <div className="flex items-center gap-2">
        <button
          className="btn"
          onClick={()=>{
            const next = !isDark
            setIsDark(next)
            document.documentElement.classList.toggle('dark', next)
          }}
          title="Toggle dark mode"
        >{isDark ? 'Light' : 'Dark'}</button>
        <select
          className="btn"
          value={project?.id ?? ''}
          onChange={e => {
            const id = Number(e.target.value)
            const p = projects.find((p: Project) => p.id === id)
            if (p) setProject(p)
          }}
        >
          <option value="" disabled>Select project…</option>
          {projects.map((p: Project) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input
          placeholder="New project name"
          className="btn"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <button className="btn btn-primary" onClick={addProject} disabled={createProjectMutation.isPending}>
          {createProjectMutation.isPending ? 'Creating...' : 'Create'}
        </button>
      </div>
    </div>
  )
}
