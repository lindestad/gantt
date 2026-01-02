import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import TopBar from './components/TopBar'
import TaskForm from './components/TaskForm'
import GanttChart from './components/GanttChart'
import { fetchTasks, wsUrl } from './api'
import type { Project, ServerEvent, Task } from './types'
import { addOrUpdateTaskUnique, removeTaskById } from './utils'

export default function App(){
  const [project, setProject] = useState<Project|null>(null)
  const queryClient = useQueryClient()

  // Use React Query for initial fetch, but keep local state for realtime updates
  // This is a hybrid approach: RQ handles caching/loading, WS handles live updates
  const { data: initialTasks } = useQuery({
    queryKey: ['tasks', project?.id],
    queryFn: () => project ? fetchTasks(project.id) : Promise.resolve([]),
    enabled: !!project
  })

  // We maintain a local copy of tasks to handle high-frequency WS updates smoothly
  const [tasks, setTasks] = useState<Task[]>([])

  // Sync RQ data to local state when it changes (e.g. on project switch)
  useEffect(() => {
    if (initialTasks) {
      setTasks(initialTasks)
    }
  }, [initialTasks])

  useEffect(() => {
    if(!project) return
    
    const ws = new WebSocket(wsUrl(project.id))
    ws.onmessage = (ev) => {
      const msg: ServerEvent = JSON.parse(ev.data)
      if(msg.type === 'hydrate') {
        setTasks(msg.tasks)
        // Also update RQ cache to keep it in sync
        queryClient.setQueryData(['tasks', project.id], msg.tasks)
      }
      if(msg.type === 'task_created') {
        setTasks(prev => {
          const next = addOrUpdateTaskUnique(prev, msg.task)
          queryClient.setQueryData(['tasks', project.id], next)
          return next
        })
      }
      if(msg.type === 'task_updated') {
        setTasks(prev => {
          const next = addOrUpdateTaskUnique(prev, msg.task)
          queryClient.setQueryData(['tasks', project.id], next)
          return next
        })
      }
      if(msg.type === 'task_deleted') {
        setTasks(prev => {
          const next = removeTaskById(prev, msg.task.id)
          queryClient.setQueryData(['tasks', project.id], next)
          return next
        })
      }
    }
    return () => ws.close()
  }, [project, queryClient])

  const startDate = useMemo(()=>{
    if(tasks.length === 0) return new Date().toISOString()
    return new Date(Math.min(...tasks.map(t => +new Date(t.start)))).toISOString()
  }, [tasks])

  return (
    <div className="min-h-screen p-4 space-y-3">
      <TopBar project={project} setProject={setProject as any} />
      {project && <TaskForm project={project} />}
      {project && <GanttChart tasks={tasks} setTasks={setTasks} startDate={startDate} />}
      {!project && (
        <div className="panel p-6 text-slate-600">
          <div className="text-lg font-medium mb-1">Create or select a project</div>
          <div className="text-sm">Then add tasks and start dragging/resizing them on the timeline. Changes sync live over WebSockets.</div>
        </div>
      )}
    </div>
  )
}
