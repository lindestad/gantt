from typing import Dict, Set
from fastapi import WebSocket
import json


class ConnectionManager:
    def __init__(self):
        self.rooms: Dict[int, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, project_id: int):
        await websocket.accept()
        self.rooms.setdefault(project_id, set()).add(websocket)

    def disconnect(self, websocket: WebSocket, project_id: int):
        if project_id in self.rooms:
            self.rooms[project_id].discard(websocket)

    async def broadcast(self, project_id: int, message: dict):
        if project_id not in self.rooms:
            return
        # Iterate over a copy to avoid runtime errors if set changes during iteration
        for connection in list(self.rooms[project_id]):
            try:
                await connection.send_text(json.dumps(message))
            except Exception:
                self.rooms[project_id].discard(connection)


manager = ConnectionManager()
