# Local FastAPI + SQLite mode

The v0.3.0 release adds an explicitly selected local API to the retained browser application. The frontend type check, 55 frontend unit tests, 48 backend tests, both production builds, 15 browser-mode journeys and six API-mode journeys passed locally on October 29, 2026. A real-process restart check also preserved the full request, resolution and history. See [VALIDATION.md](VALIDATION.md) for the release record.

This mode uses synthetic data and has no authentication or cloud deployment. FastAPI listens on the development machine's loopback interface; Vite forwards `/api` requests from its frontend, including clients using Vite's LAN address. It is a local development demonstration, not an authenticated customer service.

## Choose a mode deliberately

| Mode | Start the frontend | Data location | Recovery behavior |
|---|---|---|---|
| Browser, default | `npm run dev` | Versioned localStorage for this origin/browser | Existing explicit backup/reset flow |
| Local API | `npm run dev:api` | Backend SQLite database file | Visible error/retry; no localStorage fallback or API demo reset |

The client does not copy browser records into SQLite, seed records itself in API mode, or silently switch modes when the server is unavailable. A genuine empty API list stays empty. The backend seeds fictional requests only when initializing a new database.

## Install once

Run from the project directory, with Node.js 22.12+ and Python 3 available:

```bash
npm ci
python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements-dev.txt
```

`backend/requirements.txt` contains runtime requirements. `backend/requirements-dev.txt` adds the tools needed to run backend tests. To install only runtime requirements, use:

```bash
backend/.venv/bin/python -m pip install -r backend/requirements.txt
```

## Start two processes

Terminal 1, from the project directory:

```bash
backend/.venv/bin/python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
```

Terminal 2, from the same directory:

```bash
npm run dev:api
```

Alternatively, after installation run `bash scripts/start-fullstack.sh`. It starts a backend using `backend/.venv/bin/python` (or `MESA_API_PYTHON`), waits for health, launches API development mode and stops its owned backend on exit.

Open the URL printed by Vite, normally `http://127.0.0.1:4173`. A second device on the same network can use Vite's printed LAN address while the development machine runs both processes. Vite's proxy forwards `/api` to `http://127.0.0.1:8000`; the browser does not need to contact port 8000 directly.

The health endpoint is read-only:

```bash
curl http://127.0.0.1:8000/api/health
```

Expected successful response:

```json
{"status":"ok","storage":"sqlite"}
```

That example describes the endpoint contract, not a recorded health check. Interactive FastAPI documentation is available at `http://127.0.0.1:8000/api/docs` while the service is running, or at `/api/docs` through the Vite proxy. The OpenAPI document is `/api/openapi.json`.

## Database path and durability

The default database file is `backend/data/mesa.sqlite3`. To use a different file, set `MESA_DB_PATH` when starting the backend:

```bash
MESA_DB_PATH=/absolute/path/to/mesa-study.sqlite3 \
  backend/.venv/bin/python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
```

Use the same path after restarting to recover those records. A different database path selects a different store; it does not migrate the earlier file. The SQLite file and any runtime sidecar files are local data, not source artifacts to publish.

Persistence through a local process restart is different from Google Cloud deployment. No cloud database, hosted API or authentication has been established by this extension.

There is no reset/delete API endpoint. Demo reset controls are disabled in API mode so they cannot claim to reset backend data. To study a fresh database without overwriting existing records, stop the backend and choose another database path. Do not delete an existing file as a routine recovery step.

## Request contract

API request objects include the existing `SupportRequest` fields plus a positive integer `version`. Creation assigns the identity and initial history on the server. Mutation bodies carry the version that the client last read as `expectedVersion`.

| Method | Path | Body / result |
|---|---|---|
| GET | `/api/health` | Service/storage status |
| GET | `/api/requests` | Request list; an empty list is a valid result |
| GET | `/api/requests/{id}` | One request, including its version and history |
| POST | `/api/requests` | `CreateInput`; returns the saved request with HTTP 201; optional `Idempotency-Key` header |
| POST | `/api/requests/{id}/transitions` | `{status, note?, expectedVersion}` |
| POST | `/api/requests/{id}/comments` | `{text, expectedVersion}` |
| PATCH | `/api/requests/{id}/priority` | `{priority, expectedVersion}` |

`CreateInput` fields are `title`, `description`, `customer`, `category` and `priority`. Categories are `access`, `software`, `billing` and `other`; priorities are `low`, `normal` and `urgent`. The lifecycle remains `new → in_progress → resolved → in_progress`, and resolving requires a nonblank note.

For example, a creation body can be:

```json
{
  "title": "No carga el informe de pedidos",
  "description": "Al abrir el informe de demostración, la tabla no muestra los pedidos.",
  "customer": "Taller de ejemplo",
  "category": "software",
  "priority": "normal"
}
```

A comment body for a request currently read at version 1 is:

```json
{"text":"Se registraron los pasos para reproducir el problema.","expectedVersion":1}
```

Use the returned version for the next mutation. Do not hardcode 1 after the request has changed. These examples are illustrative JSON, not evidence of a submitted request or a particular saved ID.

## Errors and optimistic version checks

| Response | Meaning | What the client should do |
|---|---|---|
| 404 | The request ID does not exist | Explain that the record is unavailable and refresh the list |
| 409 | A stale version, conflicting lifecycle transition, or reused creation key with different input | Refresh/review current state, preserve drafts and retry only after resolving the conflict |
| 422 | Body/field validation or a command such as resolving without a required note fails | Show actionable validation feedback; keep useful input |
| 503 | The backend cannot read or write its database | Explain the storage failure and retain useful input |
| Network/service failure | No acknowledged successful result | Show failure and offer an explicit retry; keep the selected API mode |

Two clients can both read version 1. If client A saves a comment, client B's later mutation with `expectedVersion: 1` is stale and must not overwrite A's update. The response is 409, rather than treating the old record as current. This mechanism is optimistic concurrency control; it is not a user permission system.

Do not automatically replay a conflicting mutation. A refreshed request may have a different status, so the intended change may need review. Draft preservation is part of recovery, not proof that the server accepted the draft.

## Creation replay protection

Creation accepts an optional `Idempotency-Key` header of 1–128 characters drawn from letters, digits, `.`, `_`, `:` and `-`. The frontend generates a key for its pending creation attempt. SQLite stores that key, the normalized input hash and the request identity atomically with creation.

- Same key and same normalized input: return the current existing request, with the same ID and HTTP 201, instead of creating a second request.
- Same key with different normalized input: return HTTP 409.
- No key: ordinary creation; duplicate-submission protection across network retries is not established for such a caller.

If the response is lost after the server saved the request, an explicit retry from the same pending form retains the key and payload. Editing input after an uncertain creation requires refreshing/reviewing current records before starting a differently keyed attempt. Closing and reopening the form retains an unconfirmed attempt key until its result is acknowledged or an explicit server refresh has allowed review. A page reload starts a new session: inspect the list before starting a new creation after an uncertain result. The key is not a permanent user identity.

Other mutations do not use creation keys. When their outcome is uncertain after a connection error or invalid success response, the client blocks further mutations until an explicit refresh establishes current state. Review activity before repeating a comment or transition. These HTTP outcomes differ from a synchronous browser-storage exception.

## Frontend and build configuration

`VITE_MESA_STORAGE=api` is an explicit choice. In development, Vite reads the setting when starting. For production assets it is a build-time setting:

```bash
npm run build:api
npm run preview:api
```

Keep the backend running while using that preview. The configured preview port is 4174. `build:api` writes `dist-api`, preserving the default browser assets in `dist`. Setting an environment variable only when launching preview does not rewrite a frontend already built for browser mode. `dev:api` is the convenience equivalent of selecting `VITE_MESA_STORAGE=api` for development.

The Vite proxy is a development/preview convenience. It does not deploy FastAPI or provision a database on a hosting service. A future hosting configuration must route the frontend to a separately running backend; this release makes no hosted-service claim.

## Verification to perform and record

Backend setup and test dependencies are provided in `backend/requirements-dev.txt`. From the project directory:

```bash
backend/.venv/bin/python -m pytest backend/tests
npm run check
npm test
npm run build
npm run test:e2e
npm run test:e2e:api
```

The default frontend build/browser checks exercise browser mode. `test:e2e:api` builds the API assets and launches an isolated test backend/preview on 8001/4175 using a temporary SQLite path. It does not use the normal demonstration database. Do not describe a default-browser pass as API coverage. Backend tests also use isolated database files.

Record actual commands/results and dates in [VALIDATION.md](VALIDATION.md). Useful API checks include:

1. Create a request and verify its initial version/history through a subsequent GET.
2. Exercise transitions, comments and priority updates with current versions.
3. Reject invalid input and missing IDs with the documented responses.
4. Submit a stale version and confirm the conflict preserves the newer server state.
5. Restart using the same database and verify saved records remain.
6. Stop the API and confirm visible failure with no localStorage import/fallback.
7. Confirm API mode disables demo reset and retains unrelated drafts during recoverable errors.

**Specific check verified October 29:** an actual HTTP client executed a real HTTP workflow through creation, start, comment and resolution at version 4, stopped the Uvicorn process, and restarted an independent process with the same temporary SQLite file. The retrieved request matched all fields, activity and resolution; initialization did not duplicate seed data. [Restart evidence](api-restart-validation.json).

**API frontend check verified October 29:** six production-frontend browser cases passed. They covered independent clients sharing a complete workflow/history without localStorage; startup failure with visible retry and no fallback; failed creation retaining input; a response lost after the real server commit followed by closing/reopening the form and same-key retry without a duplicate; a stale-version conflict preserving drafts before explicit retry; and an uncertain detail change locked until refresh while retaining drafts.

The frontend type check, 55 frontend unit tests, 48 backend tests, both production builds, 15 browser-mode journeys and six API-mode journeys passed locally on October 29, 2026. A real-process restart check also preserved the full request, resolution and history. The backend suite emitted one Starlette deprecation warning for its supported HTTPX TestClient integration; no test failed. These checks do not certify authentication, cloud hosting or completed personal practice. See [DEVELOPMENT_LOG.md](DEVELOPMENT_LOG.md) and [the API study guide](API_STUDY.md).
