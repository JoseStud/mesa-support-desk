# Mesa local API

Optional FastAPI backend for the single-agent Mesa demonstration. Requests persist in a local SQLite file and are shared by browsers connected to this API process. This is a local/LAN demonstration without authentication, not a production customer system.

## Run

From the project root, using Python 3.12:

```bash
python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements.txt
backend/.venv/bin/python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
```

The default database is `backend/data/mesa.sqlite3`. Set `MESA_DB_PATH` to select another file. The parent directory is created when the app starts. Keep this file and its SQLite companion files out of Git. Initialization creates eight fictional requests once; restarting does not overwrite or reseed an existing database, including an initialized empty one.

The frontend's explicit API mode uses Vite's same-origin `/api` proxy to this loopback process. A caller does not need to expose port 8000 to the LAN. The browser-only build remains a separate mode and does not acquire an API merely because this backend exists.

Interactive API documentation is at `http://127.0.0.1:8000/api/docs`; its OpenAPI schema is `/api/openapi.json`. These paths also work through the running Vite `/api` proxy.

## Contract

| Method and path | Input / result |
|---|---|
| `GET /api/health` | `{ "status": "ok", "storage": "sqlite" }` after a database read check |
| `GET /api/requests` | Array of complete requests |
| `GET /api/requests/{id}` | Complete request |
| `POST /api/requests` | `title`, `description`, `customer`, `category`, `priority`; returns 201 |
| `POST /api/requests/{id}/transitions` | `status`, optional `note`, `expectedVersion` |
| `POST /api/requests/{id}/comments` | `text`, `expectedVersion` |
| `PATCH /api/requests/{id}/priority` | `priority`, `expectedVersion` |

Every returned request has the browser's existing fields and a positive integer `version`. This revision is separate from the version-1 browser storage envelope. All mutation input models reject unexpected fields. The server generates IDs, UTC timestamps with millisecond precision, state changes and activity history.

Workflow: New → In progress → Resolved; Resolved → In progress reopens a request. Resolution requires a nonblank note. Reopening preserves the earlier resolution in activity and clears the current resolution. Changing to the existing priority is a no-op with the same version and history.

Errors use `{ "detail": "Spanish explanation" }`: 404 for missing requests, 409 for stale revisions or forbidden state transitions, 422 for invalid input, and 503 when SQLite cannot read/write. A rejected command leaves the record and its history unchanged.

## Retry and concurrent updates

Send an optional `Idempotency-Key` with creation. It accepts 1–128 ASCII letters, digits or `._:-`. Retain the same key and input when retrying after an uncertain network result. SQLite stores the key with a hash of the validated, trimmed input in the same transaction as the request. Replaying that pair returns the existing current request with the same ID, without another insertion. Reusing the key with different input returns 409. Without a key, separate POSTs can create separate requests.

Each update checks `expectedVersion` inside a write transaction and uses a conditional `UPDATE ... WHERE version = ?`. Only the accepted update increments the version. If two callers submit the same version, one can succeed and the other receives 409. The frontend must refresh and let the user review a conflict rather than silently overwrite newer work.

The database stores each request, including its activity, as one JSON aggregate plus its revision. That makes a request/history change atomic while keeping this exercise small. It is not a relational reporting or multi-tenant design. There is no reset, delete, arbitrary snapshot replacement, authentication or import endpoint. Browser-mode reset does not reset the API database.

## Verify

```bash
backend/.venv/bin/python -m pip install -r backend/requirements-dev.txt
backend/.venv/bin/python -m pytest backend/tests -q
```

Tests use isolated temporary SQLite files and `create_app(db_path, seed=False, clock=...)`. They cover HTTP validation, transitions, comments, priority, first-run initialization, factory restart persistence, failed writes, concurrent revision conflicts and creation-key replay. Root release validation records the actual executed results separately.

Official references: [FastAPI testing](https://fastapi.tiangolo.com/tutorial/testing/), [Python SQLite transactions](https://docs.python.org/3.12/library/sqlite3.html), [Pydantic strict validation](https://docs.pydantic.dev/latest/concepts/strict_mode/).
