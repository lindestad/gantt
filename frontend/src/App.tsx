import { useEffect, useMemo, useState } from 'react'
import TopBar from './components/TopBar'
import TaskForm from './components/TaskForm'
import GanttChart from './components/GanttChart'
import { listTasks, wsUrl } from './api'
import type { Project, ServerEvent, Task } from './types'
import { addOrUpdateTaskUnique, removeTaskById } from './utils'

export default function App(){
  const [project, setProject] = useState<Project|null>(null)
  const [tasks, setTasks] = useState<Task[]>([])

  useEffect(() => {
    if(!project) return
    listTasks(project.id).then(setTasks)
    const ws = new WebSocket(wsUrl(project.id))
    ws.onmessage = (ev) => {
      const msg: ServerEvent = JSON.parse(ev.data)
  if(msg.type === 'hydrate') setTasks(msg.tasks)
  if(msg.type === 'task_created') setTasks(prev => addOrUpdateTaskUnique(prev, msg.task))
  if(msg.type === 'task_updated') setTasks(prev => addOrUpdateTaskUnique(prev, msg.task))
  if(msg.type === 'task_deleted') setTasks(prev => removeTaskById(prev, msg.task.id))
    }
    return () => ws.close()
  }, [project])

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
