from pydantic import BaseModel
from datetime import datetime


class ProjectCreate(BaseModel):
    name: str


class ProjectOut(BaseModel):
    id: int
    name: str
    start: str

    class Config:
        from_attributes = True


class TaskCreate(BaseModel):
    title: str
    start: str
    end: str
    progress: float | int = 0
    lane: int | None = 0
    color: str | None = None
    dependencies: list[int] = []  # task IDs this task depends on


class TaskOut(BaseModel):
    id: int
    project_id: int
    title: str
    start: str
    end: str
    progress: float
    lane: int | None = 0
    color: str | None = None
    dependencies: list[int] = []

    class Config:
        from_attributes = True
