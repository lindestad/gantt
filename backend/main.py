from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from datetime import datetime


def parse_ts(value: str) -> datetime:
    # Accept 'YYYY-MM-DD', full ISO, and 'Z' suffix
    s = value.strip()
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    return datetime.fromisoformat(s)


from typing import Dict, List, Set, Optional

from .database import SessionLocal, init_db, Project, Task, TaskDependency
from .schemas import ProjectCreate, ProjectOut, TaskCreate, TaskOut

app = FastAPI(title="Open Gantt API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()

# In-memory websocket room registry per project id
rooms: Dict[int, Set[WebSocket]] = {}


def to_task_out(t: Task) -> TaskOut:
    # Dependencies: list of predecessor IDs for this task
    deps: list[int] = []
    try:
        from sqlalchemy import select as _select

        with SessionLocal() as _db:
            deps = [
                row.depends_on_id
                for row in _db.execute(
                    _select(TaskDependency).where(TaskDependency.task_id == t.id)
                )
                .scalars()
                .all()
            ]
    except Exception:
        deps = []
    return TaskOut(
        id=t.id,
        project_id=t.project_id,
        title=t.title,
        start=t.start.isoformat(),
        end=t.end.isoformat(),
        progress=t.progress,
        lane=t.lane,
        color=t.color,
        dependencies=deps,
    )


@app.get("/projects", response_model=List[ProjectOut])
def list_projects():
    with SessionLocal() as db:
        projects = db.execute(select(Project)).scalars().all()
        out = []
        for p in projects:
            # baseline start is min task start or now
            if p.tasks:
                s = min(t.start for t in p.tasks)
            else:
                s = datetime.utcnow()
            out.append(ProjectOut(id=p.id, name=p.name, start=s.isoformat()))
        return out


@app.post("/projects", response_model=ProjectOut)
def create_project(payload: ProjectCreate):
    with SessionLocal() as db:
        p = Project(name=payload.name)
        db.add(p)
        db.commit()
        db.refresh(p)
        return ProjectOut(id=p.id, name=p.name, start=datetime.utcnow().isoformat())


@app.get("/projects/{project_id}/tasks", response_model=List[TaskOut])
def list_tasks(project_id: int):
    with SessionLocal() as db:
        tasks = (
            db.execute(select(Task).where(Task.project_id == project_id))
            .scalars()
            .all()
        )
        return [to_task_out(t) for t in tasks]


@app.post("/projects/{project_id}/tasks", response_model=TaskOut)
def create_task(project_id: int, payload: TaskCreate):
    with SessionLocal() as db:
        t = Task(
            project_id=project_id,
            title=payload.title,
            start=parse_ts(payload.start),
            end=parse_ts(payload.end),
            progress=float(payload.progress),
            lane=payload.lane or 0,
            color=payload.color,
        )
        db.add(t)
        db.commit()
        db.refresh(t)
        # write dependencies if provided
        if payload.dependencies:
            for dep_id in set(payload.dependencies):
                if dep_id == t.id:
                    continue
                db.add(TaskDependency(task_id=t.id, depends_on_id=dep_id))
            db.commit()
        out = to_task_out(t)
        # broadcast
        import anyio

        async def _broadcast():
            for ws in list(rooms.get(project_id, set())):
                try:
                    import json

                    await ws.send_text(
                        json.dumps({"type": "task_created", "task": out.dict()})
                    )
                except Exception:
                    # drop broken connections
                    rooms.get(project_id, set()).discard(ws)

        # fire-and-forget without blocking the sync endpoint
        anyio.from_thread.run(_broadcast)
        return out


@app.put("/projects/{project_id}/tasks/{task_id}", response_model=TaskOut)
def update_task(project_id: int, task_id: int, payload: TaskCreate):
    with SessionLocal() as db:
        t: Optional[Task] = db.get(Task, task_id)
        assert t and t.project_id == project_id
        t.title = payload.title
        t.start = parse_ts(payload.start)
        t.end = parse_ts(payload.end)
        t.progress = float(payload.progress)
        t.lane = payload.lane or 0
        t.color = payload.color
        db.commit()
        # replace dependencies
        db.query(TaskDependency).filter(TaskDependency.task_id == t.id).delete()
        if payload.dependencies:
            for dep_id in set(payload.dependencies):
                if dep_id == t.id:
                    continue
                db.add(TaskDependency(task_id=t.id, depends_on_id=dep_id))
        db.commit()
        db.refresh(t)
        out = to_task_out(t)
    import anyio

    async def _broadcast():
        for ws in list(rooms.get(project_id, set())):
            try:
                import json

                await ws.send_text(
                    json.dumps({"type": "task_updated", "task": out.dict()})
                )
            except Exception:
                rooms.get(project_id, set()).discard(ws)

    anyio.from_thread.run(_broadcast)
    return out


@app.delete("/projects/{project_id}/tasks/{task_id}")
def delete_task(project_id: int, task_id: int):
    with SessionLocal() as db:
        t: Optional[Task] = db.get(Task, task_id)
        if not t or t.project_id != project_id:
            return {"ok": True}
        db.delete(t)
        db.commit()
        import anyio

        async def _broadcast():
            for ws in list(rooms.get(project_id, set())):
                try:
                    import json

                    await ws.send_text(
                        json.dumps({"type": "task_deleted", "task": {"id": task_id}})
                    )
                except Exception:
                    rooms.get(project_id, set()).discard(ws)

        anyio.from_thread.run(_broadcast)
        return {"ok": True}


@app.websocket("/ws/projects/{project_id}")
async def ws_project(websocket: WebSocket, project_id: int):
    await websocket.accept()
    rooms.setdefault(project_id, set()).add(websocket)
    # hydrate with tasks
    with SessionLocal() as db:
        tasks = (
            db.execute(select(Task).where(Task.project_id == project_id))
            .scalars()
            .all()
        )
        payload = {"type": "hydrate", "tasks": [to_task_out(t).dict() for t in tasks]}
        import json

        await websocket.send_text(json.dumps(payload))
    try:
        while True:
            await websocket.receive_text()  # keep alive; client doesn't send anything
    except WebSocketDisconnect:
        rooms.get(project_id, set()).discard(websocket)
