"""Exercise real HTTP boundaries and isolated, on-disk SQLite files."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import json
import re
import sqlite3

from fastapi.testclient import TestClient
import pytest

from backend.app import create_app

NOW = datetime(2026, 10, 29, 12, 0, 0, 123456, tzinfo=timezone.utc)
PAYLOAD = {
    "title": "Revisar el acceso al panel",
    "customer": "Empresa de pruebas",
    "description": "No es posible entrar al panel desde el equipo de demostración.",
    "category": "access",
    "priority": "normal",
}


@pytest.fixture
def database(tmp_path):
    return tmp_path / "isolated.sqlite3"


@pytest.fixture
def client(database):
    with TestClient(create_app(database, seed=False, clock=lambda: NOW)) as client:
        yield client


def create(client, payload=None, key=None):
    headers = {"Idempotency-Key": key} if key is not None else {}
    response = client.post("/api/requests", json=PAYLOAD if payload is None else payload, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def test_health_and_empty_database(client):
    assert client.get("/api/health").json() == {"status": "ok", "storage": "sqlite"}
    assert client.get("/api/requests").json() == []
    assert client.get("/api/docs").status_code == 200
    assert client.get("/api/openapi.json").json()["info"]["title"] == "Mesa API"


def test_create_trims_text_and_server_owns_identity_time_and_history(client):
    request = create(client, {**PAYLOAD, "title": "  Revisar el acceso al panel  "})
    assert request["title"] == PAYLOAD["title"]
    assert request["version"] == 1
    assert re.fullmatch(r"MS-[0-9A-F]{16}", request["id"])
    assert request["status"] == "new" and request["resolution"] is None
    assert request["createdAt"] == request["updatedAt"] == "2026-10-29T12:00:00.123Z"
    assert request["activity"] == [{"id": f"{request['id']}-created-0", "kind": "created", "text": "Solicitud creada.", "at": request["createdAt"]}]
    assert client.get(f"/api/requests/{request['id']}").json() == request
    assert client.get("/api/requests").json() == [request]


@pytest.mark.parametrize("change", [
    {"title": "   "}, {"title": "ab"}, {"title": "x" * 121},
    {"description": "short"}, {"description": "x" * 2001},
    {"customer": "x"}, {"customer": "x" * 81},
    {"priority": "high"}, {"category": "unknown"}, {"customer": 12},
    {"id": "CLIENT-CHOSEN"}, {"createdAt": "2026-01-01T00:00:00.000Z"},
    {"activity": []}, {"version": 99},
])
def test_invalid_create_never_writes_and_has_string_detail(client, change):
    response = client.post("/api/requests", json={**PAYLOAD, **change})
    assert response.status_code == 422
    assert isinstance(response.json()["detail"], str)
    assert client.get("/api/requests").json() == []


def test_malformed_json_has_stable_error_shape(client):
    response = client.post("/api/requests", content="{broken", headers={"Content-Type": "application/json"})
    assert response.status_code == 422
    assert isinstance(response.json()["detail"], str)


def test_workflow_resolution_and_reopening_keep_history(client):
    request = create(client)
    path = f"/api/requests/{request['id']}"
    invalid = client.post(path + "/transitions", json={"status": "resolved", "note": "No se puede saltar la atención.", "expectedVersion": 1})
    assert invalid.status_code == 409
    assert client.get(path).json() == request
    started = client.post(path + "/transitions", json={"status": "in_progress", "expectedVersion": 1}).json()
    assert started["version"] == 2 and started["status"] == "in_progress"
    for note in (None, "   "):
        response = client.post(path + "/transitions", json={"status": "resolved", "note": note, "expectedVersion": 2})
        assert response.status_code == 422
        assert client.get(path).json() == started
    resolved = client.post(path + "/transitions", json={"status": "resolved", "note": "  Se verificó la solución.  ", "expectedVersion": 2}).json()
    assert resolved["resolution"] == "Se verificó la solución."
    assert resolved["version"] == 3
    reopened = client.post(path + "/transitions", json={"status": "in_progress", "expectedVersion": 3}).json()
    assert reopened["version"] == 4 and reopened["resolution"] is None
    assert reopened["createdAt"] == request["createdAt"]
    assert any("Se verificó la solución." in item["text"] for item in reopened["activity"])
    assert len(reopened["activity"]) == 4
    assert len({item["id"] for item in reopened["activity"]}) == 4
    assert reopened["activity"][-1]["at"] == reopened["updatedAt"]


def test_comments_priority_and_noop_priority(client):
    request = create(client)
    path = f"/api/requests/{request['id']}"
    comment = client.post(path + "/comments", json={"text": "  Se comprobó el problema.  ", "expectedVersion": 1}).json()
    assert comment["version"] == 2
    assert comment["activity"][-1]["text"] == "Se comprobó el problema."
    priority = client.patch(path + "/priority", json={"priority": "urgent", "expectedVersion": 2}).json()
    assert priority["priority"] == "urgent" and priority["version"] == 3
    assert priority["activity"][-1]["kind"] == "priority"
    assert client.patch(path + "/priority", json={"priority": "urgent", "expectedVersion": 3}).json() == priority


@pytest.mark.parametrize("suffix,method,body", [
    ("/comments", "post", {"text": "   ", "expectedVersion": 1}),
    ("/comments", "post", {"text": "x" * 2001, "expectedVersion": 1}),
    ("/comments", "post", {"text": False, "expectedVersion": 1}),
    ("/priority", "patch", {"priority": "high", "expectedVersion": 1}),
    ("/transitions", "post", {"status": "unknown", "expectedVersion": 1}),
])
def test_invalid_commands_do_not_change_the_stored_request(client, suffix, method, body):
    request = create(client)
    path = f"/api/requests/{request['id']}"
    response = getattr(client, method)(path + suffix, json=body)
    assert response.status_code == 422
    assert isinstance(response.json()["detail"], str)
    assert client.get(path).json() == request


@pytest.mark.parametrize("version", [0, -1, True, 1.0, "1", None])
def test_expected_version_requires_a_positive_integer(client, version):
    request = create(client)
    response = client.post(f"/api/requests/{request['id']}/comments", json={"text": "Comentario", "expectedVersion": version})
    assert response.status_code == 422
    assert client.get(f"/api/requests/{request['id']}").json() == request


@pytest.mark.parametrize("suffix,method,body", [
    ("", "get", None),
    ("/comments", "post", {"text": "Comentario", "expectedVersion": 1}),
    ("/transitions", "post", {"status": "in_progress", "expectedVersion": 1}),
    ("/priority", "patch", {"priority": "urgent", "expectedVersion": 1}),
])
def test_missing_request_returns_404(client, suffix, method, body):
    response = getattr(client, method)("/api/requests/missing" + suffix, **({"json": body} if body is not None else {}))
    assert response.status_code == 404
    assert isinstance(response.json()["detail"], str)


def test_stale_update_cannot_overwrite_a_newer_record(client):
    request = create(client)
    path = f"/api/requests/{request['id']}"
    saved = client.post(path + "/comments", json={"text": "Comentario guardado", "expectedVersion": 1}).json()
    response = client.patch(path + "/priority", json={"priority": "urgent", "expectedVersion": 1})
    assert response.status_code == 409
    assert "cambió" in response.json()["detail"]
    assert client.get(path).json() == saved


def test_two_simultaneous_updates_accept_one_without_losing_history(client):
    request = create(client)
    path = f"/api/requests/{request['id']}"
    def submit(text):
        return client.post(path + "/comments", json={"text": text, "expectedVersion": 1})
    with ThreadPoolExecutor(max_workers=2) as executor:
        responses = list(executor.map(submit, ["Comentario uno", "Comentario dos"]))
    assert sorted(response.status_code for response in responses) == [200, 409]
    saved = client.get(path).json()
    assert saved["version"] == 2 and len(saved["activity"]) == 2
    winner = next(response.json() for response in responses if response.status_code == 200)
    assert saved == winner


def test_failed_sql_update_rolls_back_without_altering_request(client, database):
    request = create(client)
    with sqlite3.connect(database) as connection:
        connection.execute("CREATE TRIGGER reject_update BEFORE UPDATE ON requests BEGIN SELECT RAISE(ABORT, 'simulated disk failure'); END")
    path = f"/api/requests/{request['id']}"
    response = client.post(path + "/comments", json={"text": "No se debe guardar", "expectedVersion": 1})
    assert response.status_code == 503
    assert client.get(path).json() == request


def test_database_and_versions_survive_app_restart(database):
    with TestClient(create_app(database, seed=False, clock=lambda: NOW)) as first:
        request = create(first, key="persistent-key")
        path = f"/api/requests/{request['id']}"
        saved = first.post(path + "/comments", json={"text": "Comentario persistente", "expectedVersion": 1}).json()
    with TestClient(create_app(database, seed=True, clock=lambda: NOW)) as restarted:
        assert restarted.get(path).json() == saved
        assert restarted.get("/api/requests").json() == [saved]
        replayed = create(restarted, key="persistent-key")
        assert replayed == saved
        stale = restarted.patch(path + "/priority", json={"priority": "urgent", "expectedVersion": 1})
        assert stale.status_code == 409
        assert restarted.get(path).json() == saved


def test_seed_only_runs_on_first_database_initialization(database):
    with TestClient(create_app(database, clock=lambda: NOW)) as first:
        seeded = first.get("/api/requests").json()
        assert len(seeded) == 8
        assert all(record["version"] == 1 for record in seeded)
    with TestClient(create_app(database, clock=lambda: NOW)) as restarted:
        assert restarted.get("/api/requests").json() == seeded


def test_an_initialized_empty_database_is_not_reseeded(database):
    with TestClient(create_app(database, seed=False)) as first:
        assert first.get("/api/requests").json() == []
    with TestClient(create_app(database, seed=True)) as restarted:
        assert restarted.get("/api/requests").json() == []


def test_idempotency_replay_normalizes_input_and_rejects_different_payload(client):
    original = create(client, key="create-retry")
    assert create(client, {**PAYLOAD, "title": "  " + PAYLOAD["title"] + "  "}, key="create-retry") == original
    mismatch = client.post("/api/requests", json={**PAYLOAD, "title": "Una solicitud diferente"}, headers={"Idempotency-Key": "create-retry"})
    assert mismatch.status_code == 409
    assert client.get("/api/requests").json() == [original]


def test_simultaneous_create_replays_only_insert_one_record(client):
    def submit(_):
        return client.post("/api/requests", json=PAYLOAD, headers={"Idempotency-Key": "parallel-create"})
    with ThreadPoolExecutor(max_workers=2) as executor:
        responses = list(executor.map(submit, range(2)))
    assert all(response.status_code == 201 for response in responses)
    assert responses[0].json() == responses[1].json()
    assert len(client.get("/api/requests").json()) == 1


@pytest.mark.parametrize("key", ["", " ", "x" * 129, "invalid/key"])
def test_invalid_idempotency_key_is_rejected(client, key):
    response = client.post("/api/requests", json=PAYLOAD, headers={"Idempotency-Key": key})
    assert response.status_code == 422
    assert client.get("/api/requests").json() == []


def test_backend_never_exposes_a_blind_reset_or_delete(client):
    request = create(client)
    assert client.delete(f"/api/requests/{request['id']}").status_code == 405
    assert client.post("/api/reset").status_code == 404
    assert client.get(f"/api/requests/{request['id']}").json() == request


def test_database_path_can_be_configured_without_touching_default(tmp_path, monkeypatch):
    path = tmp_path / "configured" / "mesa.sqlite3"
    monkeypatch.setenv("MESA_DB_PATH", str(path))
    with TestClient(create_app(seed=False)) as client:
        create(client)
    with sqlite3.connect(path) as connection:
        raw, version = connection.execute("SELECT document, version FROM requests").fetchone()
    assert json.loads(raw)["title"] == PAYLOAD["title"] and version == 1
