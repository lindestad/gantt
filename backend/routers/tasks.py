from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime

from ..database import SessionLocal, Task, TaskDependency
from ..schemas import TaskCreate, TaskOut, TaskPatch
from ..websocket_manager import manager

router = APIRouter()


async def get_db():
    async with SessionLocal() as db:
        yield db


def parse_ts(value: str) -> datetime:
    s = value.strip()
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    dt = datetime.fromisoformat(s)
    # Convert to naive UTC if it's aware, to match SQLite storage convention
    if dt.tzinfo is not None:
        dt = dt.astimezone(datetime.timezone.utc).replace(tzinfo=None)
    return dt


def to_task_out(t: Task) -> TaskOut:
    # dependencies_assoc is loaded via selectinload
    deps = [d.depends_on_id for d in t.dependencies_assoc]
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


@router.get("/projects/{project_id}/tasks", response_model=List[TaskOut])
async def list_tasks(project_id: int, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Task)
        .where(Task.project_id == project_id)
        .options(selectinload(Task.dependencies_assoc))
    )
    result = await db.execute(stmt)
    tasks = result.scalars().all()
    return [to_task_out(t) for t in tasks]


@router.post("/projects/{project_id}/tasks", response_model=TaskOut)
async def create_task(
    project_id: int, payload: TaskCreate, db: AsyncSession = Depends(get_db)
):
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
    await db.commit()
    await db.refresh(t)

    if payload.dependencies:
        for dep_id in set(payload.dependencies):
            if dep_id == t.id:
                continue
            db.add(TaskDependency(task_id=t.id, depends_on_id=dep_id))
        await db.commit()

    # Reload with dependencies to ensure consistent output
    stmt = (
        select(Task)
        .where(Task.id == t.id)
        .options(selectinload(Task.dependencies_assoc))
    )
    result = await db.execute(stmt)
    t = result.scalar_one()

    out = to_task_out(t)
    await manager.broadcast(project_id, {"type": "task_created", "task": out.dict()})
    return out


@router.put("/projects/{project_id}/tasks/{task_id}", response_model=TaskOut)
async def update_task(
    project_id: int,
    task_id: int,
    payload: TaskCreate,
    db: AsyncSession = Depends(get_db),
):
    t = await db.get(Task, task_id)
    if not t or t.project_id != project_id:
        raise HTTPException(status_code=404, detail="Task not found")

    t.title = payload.title
    t.start = parse_ts(payload.start)
    t.end = parse_ts(payload.end)
    t.progress = float(payload.progress)
    t.lane = payload.lane or 0
    t.color = payload.color

    # Update dependencies
    # First delete existing
    await db.execute(
        select(TaskDependency)
        .where(TaskDependency.task_id == t.id)
        .execution_options(synchronize_session=False)
    )
    # Actually, delete needs a delete statement
    from sqlalchemy import delete

    await db.execute(delete(TaskDependency).where(TaskDependency.task_id == t.id))

    if payload.dependencies:
        for dep_id in set(payload.dependencies):
            if dep_id == t.id:
                continue
            db.add(TaskDependency(task_id=t.id, depends_on_id=dep_id))

    await db.commit()

    # Reload
    stmt = (
        select(Task)
        .where(Task.id == t.id)
        .options(selectinload(Task.dependencies_assoc))
    )
    result = await db.execute(stmt)
    t = result.scalar_one()

    out = to_task_out(t)
    await manager.broadcast(project_id, {"type": "task_updated", "task": out.dict()})
    return out


@router.patch("/projects/{project_id}/tasks/{task_id}", response_model=TaskOut)
async def patch_task(
    project_id: int,
    task_id: int,
    payload: TaskPatch,
    db: AsyncSession = Depends(get_db),
):
    t = await db.get(Task, task_id)
    if not t or t.project_id != project_id:
        raise HTTPException(status_code=404, detail="Task not found")

    if payload.title is not None:
        t.title = payload.title
    if payload.start is not None:
        t.start = parse_ts(payload.start)
    if payload.end is not None:
        t.end = parse_ts(payload.end)
    if payload.progress is not None:
        t.progress = float(payload.progress)
    if payload.lane is not None:
        t.lane = int(payload.lane)
    if payload.color is not None:
        t.color = payload.color

    if payload.dependencies is not None:
        from sqlalchemy import delete

        await db.execute(delete(TaskDependency).where(TaskDependency.task_id == t.id))
        for dep_id in set(payload.dependencies):
            if dep_id == t.id:
                continue
            db.add(TaskDependency(task_id=t.id, depends_on_id=dep_id))

    await db.commit()

    # Reload
    stmt = (
        select(Task)
        .where(Task.id == t.id)
        .options(selectinload(Task.dependencies_assoc))
    )
    result = await db.execute(stmt)
    t = result.scalar_one()

    out = to_task_out(t)
    await manager.broadcast(project_id, {"type": "task_updated", "task": out.dict()})
    return out


@router.delete("/projects/{project_id}/tasks/{task_id}")
async def delete_task(
    project_id: int, task_id: int, db: AsyncSession = Depends(get_db)
):
    t = await db.get(Task, task_id)
    if not t or t.project_id != project_id:
        return {"ok": True}  # Idempotent

    await db.delete(t)
    await db.commit()

    await manager.broadcast(
        project_id, {"type": "task_deleted", "task": {"id": task_id}}
    )
    return {"ok": True}
