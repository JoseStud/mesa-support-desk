"""SQLite aggregate persistence with atomic optimistic updates and create replay keys."""
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from hashlib import sha256
import json
from pathlib import Path
import sqlite3
from typing import Any

from .domain import Record


class NotFound(Exception):
    pass


class Conflict(Exception):
    pass


class Unavailable(Exception):
    pass


def encoded(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)


class Repository:
    def __init__(self, path: str | Path):
        if str(path) == ":memory:":
            raise ValueError("Use an isolated SQLite file; connections are scoped to each operation")
        self.path = Path(path).expanduser().resolve()

    @contextmanager
    def connection(self) -> Iterator[sqlite3.Connection]:
        connection = sqlite3.connect(self.path, timeout=5, isolation_level=None)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        try:
            yield connection
        finally:
            connection.close()

    @contextmanager
    def transaction(self) -> Iterator[sqlite3.Connection]:
        with self.connection() as connection:
            connection.execute("BEGIN IMMEDIATE")
            try:
                yield connection
            except BaseException:
                connection.rollback()
                raise
            else:
                connection.commit()

    def initialize(self, seed: Callable[[], list[Record]]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.connection() as connection:
            connection.execute("PRAGMA journal_mode = WAL")
        with self.transaction() as connection:
            version = connection.execute("PRAGMA user_version").fetchone()[0]
            exists = connection.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'requests'").fetchone()
            if version not in (0, 1) or (version == 1 and not exists) or (version == 0 and exists):
                raise Unavailable("El archivo de datos usa un esquema desconocido; se ha conservado intacto.")
            if exists:
                return
            connection.execute("""
                CREATE TABLE requests (
                    id TEXT PRIMARY KEY,
                    document TEXT NOT NULL,
                    version INTEGER NOT NULL CHECK (version >= 1)
                )
            """)
            connection.execute("""
                CREATE TABLE creation_keys (
                    key TEXT PRIMARY KEY,
                    payload_hash TEXT NOT NULL,
                    request_id TEXT NOT NULL REFERENCES requests(id)
                )
            """)
            for document in seed():
                connection.execute("INSERT INTO requests(id, document, version) VALUES (?, ?, 1)",
                                   (document["id"], encoded(document)))
            connection.execute("PRAGMA user_version = 1")

    @staticmethod
    def decoded(row: sqlite3.Row) -> Record:
        try:
            value = json.loads(row["document"])
            if not isinstance(value, dict) or value.get("id") != row["id"]:
                raise ValueError("Stored request does not match its key")
        except (ValueError, TypeError) as error:
            raise Unavailable("No se pudieron leer los datos de la solicitud; se han conservado intactos.") from error
        return {**value, "version": row["version"]}

    def health(self) -> None:
        with self.connection() as connection:
            connection.execute("SELECT id FROM requests LIMIT 1").fetchone()

    def list(self) -> list[Record]:
        with self.connection() as connection:
            rows = connection.execute("SELECT id, document, version FROM requests ORDER BY rowid DESC").fetchall()
        return [self.decoded(row) for row in rows]

    @staticmethod
    def row(connection: sqlite3.Connection, request_id: str) -> sqlite3.Row:
        row = connection.execute("SELECT id, document, version FROM requests WHERE id = ?", (request_id,)).fetchone()
        if row is None:
            raise NotFound("La solicitud no existe.")
        return row

    def get(self, request_id: str) -> Record:
        with self.connection() as connection:
            return self.decoded(self.row(connection, request_id))

    def create(self, document: Record, payload: dict[str, Any], key: str | None) -> Record:
        fingerprint = sha256(encoded(payload).encode("utf-8")).hexdigest()
        with self.transaction() as connection:
            if key is not None:
                previous = connection.execute("SELECT payload_hash, request_id FROM creation_keys WHERE key = ?", (key,)).fetchone()
                if previous:
                    if previous["payload_hash"] != fingerprint:
                        raise Conflict("Este identificador de envío ya se usó con otros datos. Actualiza la lista antes de volver a enviar.")
                    return self.decoded(self.row(connection, previous["request_id"]))
            connection.execute("INSERT INTO requests(id, document, version) VALUES (?, ?, 1)",
                               (document["id"], encoded(document)))
            if key is not None:
                connection.execute("INSERT INTO creation_keys(key, payload_hash, request_id) VALUES (?, ?, ?)",
                                   (key, fingerprint, document["id"]))
        return {**document, "version": 1}

    def update(self, request_id: str, expected_version: int, mutate: Callable[[Record], Record]) -> Record:
        with self.transaction() as connection:
            current = self.decoded(self.row(connection, request_id))
            if current["version"] != expected_version:
                raise Conflict("La solicitud cambió desde que la abriste. Actualiza la lista antes de volver a guardar.")
            document = {key: value for key, value in current.items() if key != "version"}
            updated = mutate(document)
            if updated == document:
                return current
            cursor = connection.execute(
                "UPDATE requests SET document = ?, version = version + 1 WHERE id = ? AND version = ?",
                (encoded(updated), request_id, expected_version),
            )
            if cursor.rowcount != 1:
                raise Conflict("La solicitud cambió. Actualiza la lista antes de volver a guardar.")
            return {**updated, "version": expected_version + 1}
