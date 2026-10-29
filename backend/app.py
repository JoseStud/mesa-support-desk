"""Optional single-agent local API. Run behind Vite's same-origin /api proxy."""
from collections.abc import Callable
from contextlib import asynccontextmanager
from datetime import datetime
import os
from pathlib import Path
import sqlite3
from typing import Annotated

from fastapi import FastAPI, Header
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from .domain import InvalidCommand, InvalidTransition, add_comment, change_priority, create_request, seed_requests, transition, utc_now
from .models import CommentInput, CreateInput, PriorityInput, RequestView, TransitionInput
from .repository import Conflict, NotFound, Repository, Unavailable


def create_app(
    db_path: str | Path | None = None,
    *,
    seed: bool = True,
    clock: Callable[[], datetime] = utc_now,
) -> FastAPI:
    configured = db_path if db_path is not None else os.getenv("MESA_DB_PATH", str(Path(__file__).parent / "data" / "mesa.sqlite3"))
    repository = Repository(configured)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        repository.initialize(lambda: seed_requests(clock()) if seed else [])
        yield

    app = FastAPI(title="Mesa API", version="0.3.0", lifespan=lifespan,
                  docs_url="/api/docs", openapi_url="/api/openapi.json", redoc_url=None)
    app.state.repository = repository

    @app.exception_handler(RequestValidationError)
    async def validation_error(_, error: RequestValidationError):
        first = error.errors()[0]
        field = str(first["loc"][-1])
        labels = {"title": "título", "description": "descripción", "customer": "cliente", "category": "categoría",
                  "priority": "prioridad", "status": "estado", "note": "nota de resolución", "text": "comentario",
                  "expectedVersion": "versión de la solicitud", "idempotency-key": "identificador de envío"}
        label = labels.get(field, "solicitud")
        if first["type"] == "extra_forbidden":
            detail = "El envío contiene campos no permitidos. Envía únicamente los datos del formulario."
        else:
            detail = f"Revisa el campo {label}: el valor falta o no tiene un formato válido."
        return JSONResponse(status_code=422, content={"detail": detail})

    @app.exception_handler(NotFound)
    async def missing_error(_, error: NotFound):
        return JSONResponse(status_code=404, content={"detail": str(error)})

    @app.exception_handler(Conflict)
    @app.exception_handler(InvalidTransition)
    async def conflict_error(_, error: Exception):
        return JSONResponse(status_code=409, content={"detail": str(error)})

    @app.exception_handler(InvalidCommand)
    async def command_error(_, error: InvalidCommand):
        return JSONResponse(status_code=422, content={"detail": str(error)})

    @app.exception_handler(Unavailable)
    @app.exception_handler(sqlite3.Error)
    async def storage_error(_, __):
        return JSONResponse(status_code=503, content={"detail": "No se pudo leer o guardar la solicitud. Conserva el formulario e inténtalo de nuevo."})

    @app.get("/api/health")
    def health():
        repository.health()
        return {"status": "ok", "storage": "sqlite"}

    @app.get("/api/requests", response_model=list[RequestView])
    def list_requests():
        return repository.list()

    @app.get("/api/requests/{request_id}", response_model=RequestView)
    def get_request(request_id: str):
        return repository.get(request_id)

    @app.post("/api/requests", status_code=201, response_model=RequestView)
    def post_request(
        data: CreateInput,
        idempotency_key: Annotated[str | None, Header(min_length=1, max_length=128, pattern=r"^[A-Za-z0-9._:-]+$")] = None,
    ):
        return repository.create(create_request(data, clock()), data.model_dump(), idempotency_key)

    @app.post("/api/requests/{request_id}/transitions", response_model=RequestView)
    def post_transition(request_id: str, data: TransitionInput):
        return repository.update(request_id, data.expectedVersion,
                                 lambda current: transition(current, data.status, data.note, clock()))

    @app.post("/api/requests/{request_id}/comments", response_model=RequestView)
    def post_comment(request_id: str, data: CommentInput):
        return repository.update(request_id, data.expectedVersion,
                                 lambda current: add_comment(current, data.text, clock()))

    @app.patch("/api/requests/{request_id}/priority", response_model=RequestView)
    def patch_priority(request_id: str, data: PriorityInput):
        return repository.update(request_id, data.expectedVersion,
                                 lambda current: change_priority(current, data.priority, clock()))

    return app


app = create_app()
