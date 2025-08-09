import { useEffect, useMemo, useRef, useState } from 'react'
import type { Task } from '../types'
import { updateTask, deleteTask } from '../api'

type Zoom = 'day'|'week'|'month'

function startOfDay(d: Date){ const x = new Date(d); x.setHours(0,0,0,0); return x }
function daysBetween(a: Date, b: Date){ return Math.round((startOfDay(b).getTime()-startOfDay(a).getTime())/86400000) }
function addDays(d: Date, n: number){ const x = new Date(d); x.setDate(x.getDate()+n); return x }

export default function GanttChart({ tasks, setTasks, startDate }:{ tasks: Task[], setTasks: (t: Task[])=>void, startDate: string }) {
  const [zoom, setZoom] = useState<Zoom>('week')
  const containerRef = useRef<HTMLDivElement>(null)
  const base = useMemo(()=> new Date(startDate), [startDate])

  const dayWidth = zoom === 'day' ? 48 : zoom === 'week' ? 24 : 12
  const rowHeight = 32
  const paddingLeft = 240

  const spanDays = Math.max(60, ...tasks.map(t => daysBetween(base, new Date(t.end))+7))
  const headerDays = Array.from({length: spanDays}, (_,i)=> addDays(base, i))

  function onDrag(task: Task, dxDays: number, resizeEdge?: 'start'|'end'){
    const s = new Date(task.start); const e = new Date(task.end)
    if(resizeEdge === 'start'){
      s.setDate(s.getDate()+dxDays)
      if(s > e) s.setTime(e.getTime())
    }else if(resizeEdge === 'end'){
      e.setDate(e.getDate()+dxDays)
      if(e < s) e.setTime(s.getTime())
    }else{
      s.setDate(s.getDate()+dxDays); e.setDate(e.getDate()+dxDays)
    }
    const updated = { ...task, start: s.toISOString(), end: e.toISOString() }
    setTasks(tasks.map(t => t.id === task.id ? updated : t))
    updateTask(task.project_id, task.id, updated).catch(()=>{})
  }

  function handlePointer(e: React.PointerEvent, task: Task, mode: 'move'|'resize-start'|'resize-end'){
    const startX = e.clientX
    const start = { ...task }
    ;(e.target as Element).setPointerCapture(e.pointerId)
    function onMove(ev: PointerEvent){
      const dx = ev.clientX - startX
      const dxDays = Math.round(dx / dayWidth)
      if(dxDays !== 0){
        if(mode === 'move') onDrag(start, dxDays)
        if(mode === 'resize-start') onDrag(start, dxDays, 'start')
        if(mode === 'resize-end') onDrag(start, dxDays, 'end')
      }
    }
    function onUp(){
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  async function removeTask(task: Task){
    await deleteTask(task.project_id, task.id)
    setTasks(tasks.filter(t => t.id !== task.id))
  }

  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2">
        <div className="text-sm text-slate-500">Timeline</div>
        <div className="flex items-center gap-2">
          <select className="btn" value={zoom} onChange={e=>setZoom(e.target.value as Zoom)}>
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
        </div>
      </div>

      <div className="flex">
        {/* Left list */}
        <div className="w-[240px] border-r border-slate-200">
          <div className="h-10 flex items-center px-3 text-xs text-slate-500">Tasks</div>
          {tasks.map((t,i)=>(
            <div key={t.id} className="flex items-center h-[32px] px-3 border-t border-slate-100">
              <div className="truncate text-sm">{t.title}</div>
              <button className="ml-auto text-xs text-red-500" onClick={()=>removeTask(t)}>Delete</button>
            </div>
          ))}
        </div>

        {/* Right timeline */}
        <div ref={containerRef} className="relative overflow-auto scrollbar-thin" style={{ width: '100%' }}>
          {/* Header: months row + days grid */}
          <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-slate-200" style={{ paddingLeft }}>
            {/* Months */}
            <div className="flex h-6 text-xs text-slate-600">
              {(() => {
                const groups: { label: string; days: number }[] = []
                let current = ''
                headerDays.forEach(d => {
                  const label = d.toLocaleString(undefined, { month: 'short', year: 'numeric' })
                  if (label !== current) { groups.push({ label, days: 1 }); current = label }
                  else { groups[groups.length-1].days++ }
                })
                return groups.map((g, idx) => (
                  <div key={idx} className="shrink-0 flex items-center justify-center border-l border-slate-200" style={{ width: g.days * dayWidth }}>
                    <span className="px-2">{g.label}</span>
                  </div>
                ))
              })()}
            </div>
            {/* Days grid headers */}
            <div className="flex h-8 items-center text-[11px] text-slate-500">
              {headerDays.map((d, i) => (
                <div key={i} className={`shrink-0 border-l ${i % 7 === 0 ? 'border-slate-300' : 'border-slate-100'} text-center`} style={{ width: dayWidth }}>
                  {d.toISOString().slice(5,10)}
                </div>
              ))}
            </div>
          </div>

          {/* Grid */}
          <div className="relative" style={{ paddingLeft, height: tasks.length * rowHeight }}>
            {/* vertical gridlines */}
            <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>
              <div className="flex h-full">
                {headerDays.map((_,i)=> (
                  <div
                    key={i}
                    className={`shrink-0 border-l ${i%7===0?'border-slate-300':'border-slate-100'}`}
                    style={{ width: dayWidth }}
                  />
                ))}
              </div>
            </div>

            {/* dependency lines (simple orthogonal) */}
            <svg className="absolute inset-0 pointer-events-none" style={{ left: paddingLeft }}>
              {tasks.flatMap((t, i) => (t.dependencies ?? []).map((depId) => {
                const depIndex = tasks.findIndex(x => x.id === depId)
                const dep = depIndex >= 0 ? tasks[depIndex] : null
                if (!dep) return null
                const depWidth = (daysBetween(new Date(dep.start), new Date(dep.end)) + 1) * dayWidth
                const sx = daysBetween(base, new Date(dep.end)) * dayWidth + Math.max(16, depWidth)
                const sy = depIndex * rowHeight + 12
                const tx = daysBetween(base, new Date(t.start)) * dayWidth
                const ty = i * rowHeight + 12
                const midX = Math.max(sx + 8, tx - 12)
                return (
                  <path key={`${t.id}-${depId}`} d={`M ${sx} ${sy} L ${midX} ${sy} L ${midX} ${ty} L ${tx} ${ty}`} stroke="#64748b" strokeWidth="1.5" fill="none" markerEnd="url(#arrow)" />
                )
              })).filter(Boolean)}
              <defs>
                <marker id="arrow" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L6,3 z" fill="#64748b" />
                </marker>
              </defs>
            </svg>

            {/* task bars */}
            {tasks.map((t,i)=>{
              const x = daysBetween(base, new Date(t.start)) * dayWidth
              const w = (daysBetween(new Date(t.start), new Date(t.end)) + 1) * dayWidth
              const y = i * rowHeight + 4
              function onContextMenu(e: React.MouseEvent){
                e.preventDefault()
                // TODO: open custom context menu (colors, delete, etc.)
                // for now, just log; wire up a menu component later
                console.debug('context menu on task', t.id)
              }
              return (
                <div key={t.id} className="absolute" style={{ left: x + paddingLeft, top: y }}>
                  <div className="group relative h-6 rounded-md bg-slate-900/90 text-white shadow-sm select-none flex items-center"
                    style={{ width: Math.max(16, w) }}
                    onPointerDown={e=>handlePointer(e, t, 'move')}
                    onContextMenu={onContextMenu}
                  >
                    <div className="absolute left-0 top-0 h-full w-2 cursor-ew-resize rounded-l-md bg-black/40"
                      onPointerDown={e=>{e.stopPropagation(); handlePointer(e, t, 'resize-start')}} />
                    <div className="px-2 text-xs">{t.title}</div>
                    <div className="absolute right-0 top-0 h-full w-2 cursor-ew-resize rounded-r-md bg-black/40"
                      onPointerDown={e=>{e.stopPropagation(); handlePointer(e, t, 'resize-end')}} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
