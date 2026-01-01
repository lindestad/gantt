from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from .database import init_db, SessionLocal, Task
from .routers import projects, tasks
from .websocket_manager import manager
from .schemas import TaskOut


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB on startup
    await init_db()
    yield


app = FastAPI(title="Open Gantt API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router)
app.include_router(tasks.router)


@app.websocket("/ws/projects/{project_id}")
async def ws_project(websocket: WebSocket, project_id: int):
    await manager.connect(websocket, project_id)

    # Hydrate with existing tasks
    try:
        async with SessionLocal() as db:
            stmt = (
                select(Task)
                .where(Task.project_id == project_id)
                .options(selectinload(Task.dependencies_assoc))
            )
            result = await db.execute(stmt)
            tasks_list = result.scalars().all()

            out_tasks = []
            for t in tasks_list:
                deps = [d.depends_on_id for d in t.dependencies_assoc]
                out_tasks.append(
                    TaskOut(
                        id=t.id,
                        project_id=t.project_id,
                        title=t.title,
                        start=t.start.isoformat(),
                        end=t.end.isoformat(),
                        progress=t.progress,
                        lane=t.lane,
                        color=t.color,
                        dependencies=deps,
                    ).dict()
                )

            await websocket.send_json({"type": "hydrate", "tasks": out_tasks})

        while True:
            await websocket.receive_text()  # keep alive
    except WebSocketDisconnect:
        manager.disconnect(websocket, project_id)
    except Exception:
        # Handle other exceptions to ensure disconnect is called
        manager.disconnect(websocket, project_id)
