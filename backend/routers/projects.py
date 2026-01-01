from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List
from datetime import datetime, timezone

from ..database import SessionLocal, Project
from ..schemas import ProjectCreate, ProjectOut

router = APIRouter()


async def get_db():
    async with SessionLocal() as db:
        yield db


@router.get("/projects", response_model=List[ProjectOut])
async def list_projects(db: AsyncSession = Depends(get_db)):
    # Eager load tasks to compute start date
    result = await db.execute(select(Project).options(selectinload(Project.tasks)))
    projects = result.scalars().all()
    out = []
    for p in projects:
        if p.tasks:
            # Ensure we handle naive/aware datetimes correctly.
            # Assuming stored as naive UTC.
            s = min(t.start for t in p.tasks)
        else:
            s = datetime.now(timezone.utc).replace(tzinfo=None)
        out.append(ProjectOut(id=p.id, name=p.name, start=s.isoformat()))
    return out


@router.post("/projects", response_model=ProjectOut)
async def create_project(payload: ProjectCreate, db: AsyncSession = Depends(get_db)):
    p = Project(name=payload.name)
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return ProjectOut(
        id=p.id, name=p.name, start=datetime.now(timezone.utc).isoformat()
    )
