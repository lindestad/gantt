import { useEffect, useMemo, useRef, useState } from 'react'
import type { Task } from '../types'
import { updateTask, deleteTask, patchTask } from '../api'

type Zoom = 'day'|'week'|'month'

function startOfDay(d: Date){ const x = new Date(d); x.setHours(0,0,0,0); return x }
function daysBetween(a: Date, b: Date){ return Math.round((startOfDay(b).getTime()-startOfDay(a).getTime())/86400000) }
function addDays(d: Date, n: number){ const x = new Date(d); x.setDate(x.getDate()+n); return x }

type DragState = {
  id: number,
  mode: 'move'|'resize-start'|'resize-end',
  startX: number,
  dxPx: number,
  originalStart: string,
  originalEnd: string
}

export default function GanttChart({ tasks, setTasks, startDate }:{ tasks: Task[], setTasks: (t: Task[])=>void, startDate: string }) {
  const [zoom, setZoom] = useState<Zoom>('week')
  const containerRef = useRef<HTMLDivElement>(null)
  const base = useMemo(()=> new Date(startDate), [startDate])
  const [menu, setMenu] = useState<{ x: number, y: number, taskId: number }|null>(null)
  const [drag, setDrag] = useState<DragState|null>(null)
  const dragRef = useRef<DragState|null>(null)

  const dayWidth = zoom === 'day' ? 48 : zoom === 'week' ? 24 : 12
  const rowHeight = 32
  const barVerticalPad = 4 // space above and below each bar
  const barHeight = rowHeight - barVerticalPad * 2
  const paddingLeft = 240

  const spanDays = Math.max(60, ...tasks.map(t => daysBetween(base, new Date(t.end))+7))
  const headerDays = Array.from({length: spanDays}, (_,i)=> addDays(base, i))

  function commitTaskChange(startTask: Task, dxDays: number, mode: 'move'|'resize-start'|'resize-end'){
    const s = new Date(startTask.start); const e = new Date(startTask.end)
    if(mode === 'resize-start'){
      s.setDate(s.getDate()+dxDays)
      if(s > e) s.setTime(e.getTime())
    }else if(mode === 'resize-end'){
      e.setDate(e.getDate()+dxDays)
      if(e < s) e.setTime(s.getTime())
    }else{
      s.setDate(s.getDate()+dxDays); e.setDate(e.getDate()+dxDays)
    }
    const updated = { ...startTask, start: s.toISOString(), end: e.toISOString() }
    setTasks(tasks.map(t => t.id === startTask.id ? updated : t))
    updateTask(startTask.project_id, startTask.id, updated).catch(()=>{})
  }

  function handlePointer(e: React.PointerEvent, task: Task, mode: 'move'|'resize-start'|'resize-end'){
    const startX = e.clientX
    const start = { ...task }
    ;(e.target as Element).setPointerCapture(e.pointerId)
    const init: DragState = { id: task.id, mode, startX, dxPx: 0, originalStart: task.start, originalEnd: task.end }
    setDrag(init)
    dragRef.current = init
    function onMove(ev: PointerEvent){
      const next = dragRef.current ? { ...dragRef.current, dxPx: ev.clientX - dragRef.current.startX } : null
      if(next){ dragRef.current = next; setDrag(next) }
    }
    function cleanup(){
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('keydown', onKey)
    }
    function onUp(){
  const current = dragRef.current
      cleanup()
      setDrag(null)
      if(!current) return
      const dxDays = Math.round(current.dxPx / dayWidth)
      if(dxDays !== 0){
        const startTask = { ...start, start: current.originalStart, end: current.originalEnd }
        commitTaskChange(startTask, dxDays, current.mode)
      }
    }
    function onKey(ev: KeyboardEvent){
      if(ev.key === 'Escape'){
        cleanup()
        setDrag(null)
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('keydown', onKey)
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
            {/* Months (ensure previous month label appears if the range doesn't start on day 1) */}
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
            {/* Days grid headers (show day number only; month shown above) */}
            <div className="flex h-8 items-center text-[11px] text-slate-500">
              {headerDays.map((d, i) => {
                const dayNum = d.getDate()
                return (
                  <div key={i} className={`shrink-0 border-l ${i % 7 === 0 ? 'border-slate-300' : 'border-slate-100'} text-center`} style={{ width: dayWidth }}>
                    {dayNum}
                  </div>
                )
              })}
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
            <svg className="absolute inset-0 pointer-events-none z-0" style={{ left: paddingLeft }}>
              {tasks.flatMap((t, i) => (t.dependencies ?? []).map((depId) => {
                const depIndex = tasks.findIndex(x => x.id === depId)
                const dep = depIndex >= 0 ? tasks[depIndex] : null
                if (!dep) return null
                const depWidth = (daysBetween(new Date(dep.start), new Date(dep.end)) + 1) * dayWidth
        const centerOffset = barVerticalPad + barHeight / 2
        const sx = daysBetween(base, new Date(dep.end)) * dayWidth + Math.max(16, depWidth)
        const sy = depIndex * rowHeight + centerOffset
        const tx = daysBetween(base, new Date(t.start)) * dayWidth
        const ty = i * rowHeight + centerOffset
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
              const y = i * rowHeight + barVerticalPad
              function onContextMenu(e: React.MouseEvent){
                e.preventDefault()
                setMenu({ x: e.clientX, y: e.clientY, taskId: t.id })
              }
              const isDragging = drag && drag.id === t.id
              // Compute pixel preview adjustments during drag for smoothness
              const preview = isDragging ? drag : null
              const previewTranslate = preview?.mode === 'move' || preview?.mode === 'resize-start' ? (preview.dxPx || 0) : 0
              const previewWidth = preview ? (
                preview.mode === 'resize-start' ? Math.max(16, w - (preview.dxPx || 0)) :
                preview.mode === 'resize-end' ? Math.max(16, w + (preview.dxPx || 0)) :
                Math.max(16, w)
              ) : Math.max(16, w)
              return (
                <div key={t.id} className="absolute z-10" style={{ left: x + paddingLeft, top: y }}>
                  <div className="group relative rounded-md text-white shadow-sm select-none flex items-center"
                    style={{ height: barHeight, width: previewWidth, background: t.color || 'rgba(15,23,42,0.9)', transform: `translateX(${previewTranslate}px)` }}
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
      {menu && (()=>{
        const cur = tasks.find(t=>t.id===menu.taskId)
        if(!cur) return null
        const deps = new Set<number>(cur.dependencies ?? [])
        const toggleDep = async (depId: number) => {
          if(depId === cur.id) return
          if(deps.has(depId)) deps.delete(depId); else deps.add(depId)
          const nextList = Array.from(deps)
          setTasks(tasks.map(t => t.id===cur.id ? { ...t, dependencies: nextList } : t))
          await patchTask(cur.project_id, cur.id, { dependencies: nextList })
        }
        return (
          <div className="fixed z-50 bg-white dark:bg-slate-800 shadow-lg ring-1 ring-slate-200 dark:ring-slate-700 rounded-md p-3 flex flex-col gap-2 min-w-56"
               style={{ left: menu.x, top: menu.y }}
               onMouseLeave={()=>setMenu(null)}
          >
            <div className="text-xs text-slate-500 pb-1">Color</div>
            <div className="flex gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
              {['#0ea5e9','#22c55e','#eab308','#ef4444','#6366f1','#14b8a6','#f97316'].map(c => (
                <button key={c} className="h-6 w-6 rounded" style={{ background: c }} onClick={async()=>{
                  setTasks(tasks.map(x=> x.id===cur.id ? { ...x, color: c } : x))
                  setMenu(null)
                  await patchTask(cur.project_id, cur.id, { color: c })
                }} />
              ))}
            </div>
            <div className="text-xs text-slate-500">Depends on</div>
            <div className="max-h-48 overflow-auto pr-1">
              {tasks.map(t => (
                <label key={t.id} className={`flex items-center gap-2 py-1 px-1 rounded ${t.id===cur.id ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>
                  <input type="checkbox" disabled={t.id===cur.id} checked={deps.has(t.id)} onChange={()=>toggleDep(t.id)} />
                  <span className="text-sm truncate">{t.title}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-end pt-2">
              <button className="btn" onClick={()=>setMenu(null)}>Close</button>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
