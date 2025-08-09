import json
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)


def test_create_project_and_task_with_dependency():
    # create project
    r = client.post("/projects", json={"name": "Demo"})
    assert r.status_code == 200
    p = r.json()
    # create base task
    t1 = client.post(
        f"/projects/{p['id']}/tasks",
        json={
            "title": "Ingredients",
            "start": "2025-01-01",
            "end": "2025-01-02",
            "progress": 0,
        },
    ).json()
    # create dependent task
    t2 = client.post(
        f"/projects/{p['id']}/tasks",
        json={
            "title": "Bake",
            "start": "2025-01-03",
            "end": "2025-01-04",
            "progress": 0,
            "dependencies": [t1["id"]],
        },
    ).json()
    assert t2["dependencies"] == [t1["id"]]
    # list tasks
    tasks = client.get(f"/projects/{p['id']}/tasks").json()
    ids = {t["id"]: t for t in tasks}
    assert ids[t2["id"]]["dependencies"] == [t1["id"]]


def test_patch_dependencies_multiple():
    client = TestClient(app)
    p = client.post("/projects", json={"name": "Demo2"}).json()
    a = client.post(
        f"/projects/{p['id']}/tasks",
        json={"title": "A", "start": "2025-01-01", "end": "2025-01-02", "progress": 0},
    ).json()
    b = client.post(
        f"/projects/{p['id']}/tasks",
        json={"title": "B", "start": "2025-01-03", "end": "2025-01-03", "progress": 0},
    ).json()
    c = client.post(
        f"/projects/{p['id']}/tasks",
        json={"title": "C", "start": "2025-01-04", "end": "2025-01-05", "progress": 0},
    ).json()
    # set B depends on A and C
    patched = client.patch(
        f"/projects/{p['id']}/tasks/{b['id']}",
        json={"dependencies": [a["id"], c["id"]]},
    ).json()
    assert set(patched["dependencies"]) == {a["id"], c["id"]}
    # remove A, keep C
    patched2 = client.patch(
        f"/projects/{p['id']}/tasks/{b['id']}", json={"dependencies": [c["id"]]}
    ).json()
    assert patched2["dependencies"] == [c["id"]]
