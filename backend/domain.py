"""Server-owned workflow rules matching the browser's request contract."""
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from secrets import token_hex
from typing import Any

from .models import CreateInput, Priority, Status

Record = dict[str, Any]
STATUS_LABELS = {"new": "Nueva", "in_progress": "En curso", "resolved": "Resuelta"}
PRIORITY_LABELS = {"low": "Baja", "normal": "Normal", "urgent": "Urgente"}


class InvalidTransition(Exception):
    pass


class InvalidCommand(Exception):
    pass


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def timestamp(now: datetime, previous: str | None = None) -> str:
    if now.tzinfo is None:
        raise ValueError("The backend clock must return a timezone-aware datetime")
    at = now.astimezone(timezone.utc)
    if previous:
        # A backwards clock adjustment must not make stored history nonchronological.
        at = max(at, datetime.fromisoformat(previous.replace("Z", "+00:00")))
    return at.isoformat(timespec="milliseconds").replace("+00:00", "Z")


def create_request(data: CreateInput, now: datetime, request_id: str | None = None) -> Record:
    identifier = request_id or f"MS-{token_hex(8).upper()}"
    at = timestamp(now)
    return {
        **data.model_dump(),
        "id": identifier,
        "status": "new",
        "createdAt": at,
        "updatedAt": at,
        "resolution": None,
        "activity": [{"id": f"{identifier}-created-0", "kind": "created", "text": "Solicitud creada.", "at": at}],
    }


def changed(request: Record, kind: str, message: str, now: datetime, **changes: Any) -> Record:
    result = deepcopy(request)
    at = timestamp(now, request["updatedAt"])
    result.update(changes, updatedAt=at)
    result["activity"].append({
        "id": f"{request['id']}-{kind}-{len(request['activity'])}",
        "kind": kind,
        "text": message,
        "at": at,
    })
    return result


def transition(request: Record, status: Status, note: str | None, now: datetime) -> Record:
    allowed = {"new": {"in_progress"}, "in_progress": {"resolved"}, "resolved": {"in_progress"}}
    current = request["status"]
    if status not in allowed[current]:
        raise InvalidTransition(f"No se puede cambiar de {STATUS_LABELS[current]} a {STATUS_LABELS[status]}.")
    if status == "resolved" and (note is None or not note.strip()):
        raise InvalidCommand("La nota de resolución es obligatoria.")
    resolution = note.strip() if status == "resolved" and note else None
    message = (
        f"Resuelta: {resolution}" if status == "resolved"
        else "Solicitud reabierta: Resuelta → En curso." if current == "resolved"
        else f"Estado: {STATUS_LABELS[current]} → {STATUS_LABELS[status]}."
    )
    return changed(request, "status", message, now, status=status, resolution=resolution)


def add_comment(request: Record, text: str, now: datetime) -> Record:
    return changed(request, "comment", text, now)


def change_priority(request: Record, priority: Priority, now: datetime) -> Record:
    if priority == request["priority"]:
        return request
    message = f"Prioridad: {PRIORITY_LABELS[request['priority']]} → {PRIORITY_LABELS[priority]}."
    return changed(request, "priority", message, now, priority=priority)


def seed_requests(now: datetime) -> list[Record]:
    cases = [
        ("Panadería Brisa", "No podemos acceder al panel", "El equipo recibe un mensaje de sesión expirada al entrar al panel de pedidos.", "access", "urgent", "new"),
        ("Taller Horizonte", "El informe de ventas no carga", "Al seleccionar el mes actual, el informe queda cargando y no muestra los totales.", "software", "normal", "in_progress"),
        ("Librería Luma", "Corregir los datos de la factura", "La factura de este mes muestra un nombre comercial anterior. Solicitamos actualizarlo.", "billing", "normal", "resolved"),
        ("Estudio Laurel", "Añadir una categoría al formulario", "Necesitamos clasificar consultas sobre entregas con una categoría adicional.", "other", "low", "new"),
        ("Café Nube", "Error al guardar nuevos pedidos", "El botón de guardar devuelve un error y el pedido no aparece en la lista del turno.", "software", "urgent", "in_progress"),
        ("Mercado Sendero", "Restablecer el acceso del encargado", "El encargado cambió de equipo y necesita volver a entrar a su cuenta de demostración.", "access", "normal", "resolved"),
        ("Academia Faro", "Cambiar el texto de bienvenida", "Queremos actualizar el mensaje inicial para incluir los horarios de atención.", "other", "low", "new"),
        ("Bodega Cobalto", "Revisar un cobro repetido", "El resumen de pagos parece mostrar dos veces el mismo concepto de servicio.", "billing", "normal", "in_progress"),
    ]
    result = []
    for index, (customer, title, description, category, priority, status) in enumerate(cases):
        created = now - timedelta(hours=12 + index * 7)
        data = CreateInput(customer=customer, title=title, description=description, category=category, priority=priority)
        request = create_request(data, created, f"MS-{1048 + index}")
        if status != "new":
            request = transition(request, "in_progress", None, created + timedelta(hours=1))
            request = add_comment(request, "Se registraron los pasos para reproducir el caso.", created + timedelta(hours=2))
        if status == "resolved":
            request = transition(request, "resolved", "Se corrigió el caso y se verificó la solución con datos ficticios.", created + timedelta(hours=3))
        result.append(request)
    return result
