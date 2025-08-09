# Open Gantt (MVP)

A lightweight, modern, collaborative Gantt chart for student orgs.
- Clean React + Tailwind UI
- Drag to move, resize to change duration
- Realtime sync via WebSockets (project rooms)
- FastAPI + SQLite backend
- Docker Compose for one-command run

## Quick start (Docker)
```bash
docker compose up
```
Visit <http://localhost:5173>. The frontend talks to the API at <http://localhost:8001> (mapped to container 8000). If you already use 8000 locally, this avoids port conflicts.

## Dev (local)
Backend:
```bash
cd backend
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Frontend:
```bash
cd frontend
npm i
npm run dev
# set VITE_API_URL if your api is not on localhost:8000
```

## Roadmap
- [ ] Assignees & resources per task
- [ ] Dependencies & critical path
- [ ] Milestones & swimlanes
- [ ] Auth (GitHub/Google) + roles
- [ ] Persistence for websocket presence + optimistic locks
- [ ] Export to PNG/PDF/CSV
- [ ] Week/month grouping headers & zoom presets
- [ ] Server deploy recipes (Render, Fly, Railway, Azure App Service)
