"""
Dashboard persistence service plus drill-down resolution.

The default instance uses the SQLAlchemy repository. Passing ``None`` to the
constructor keeps the former in-memory mode available for isolated callers.

Dashboard queries resolve saved PostgreSQL sources, use SQLAlchemy bound
parameters, run in read-only transactions, and have a bounded execution time
and row count. Drill-down queries use clicked rows only as bound parameter
values for the query registered on the widget.
"""
from __future__ import annotations

import uuid
import re
from collections.abc import Callable
from typing import Optional

from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL, Engine
from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.models.db import SchemaConfigModel, SchemaCredentialModel
from app.models.schemas import DashboardSpec, WidgetSpec, SchemaConfig
from app.services.dashboard_repository import DashboardRepository
from app.services.credential_crypto import decrypt_credential, encrypt_credential

MAX_WIDGET_ROWS = 5000
QUERY_TIMEOUT_MS = 15000
_READ_QUERY_START = re.compile(r"(?:\s|--[^\n]*(?:\n|$)|/\*.*?\*/)*(SELECT|WITH)\b", re.IGNORECASE | re.DOTALL)


class DashboardService:
    def __init__(
        self, session_factory: Callable[[], Session] | None = SessionLocal
    ) -> None:
        self._repository = (
            DashboardRepository(session_factory) if session_factory is not None else None
        )
        self._dashboards: dict[str, DashboardSpec] = {}
        self._schema_passwords: dict[str, str] = {}

    def set_schema_password(self, schema_id: str, password: str) -> None:
        if self._repository is None:
            self._schema_passwords[schema_id] = password
            return
        with self._repository._session_factory() as session:
            with session.begin():
                session.merge(
                    SchemaCredentialModel(
                        schema_id=schema_id,
                        encrypted_password=encrypt_credential(password),
                    )
                )

    def get_schema_password(self, schema_id: str) -> str | None:
        if self._repository is None:
            return self._schema_passwords.get(schema_id)
        with self._repository._session_factory() as session:
            record = session.get(SchemaCredentialModel, schema_id)
            return decrypt_credential(record.encrypted_password) if record else None

    def create_schema(self, schema: SchemaConfig) -> SchemaConfig:
        if self._repository is not None:
            with self._repository._session_factory() as session:
                with session.begin():
                    record = SchemaConfigModel(
                        id=schema.id,
                        name=schema.name,
                        source_type=schema.source_type.value,
                        status=schema.status.value,
                        owner=schema.owner,
                        config=schema.model_dump(mode="json"),
                    )
                    session.merge(record)
            return schema
        self._dashboards[schema.id] = DashboardSpec(id=schema.id, title=schema.name)
        return schema

    def get_schema(self, schema_id: str) -> SchemaConfig | None:
        if self._repository is not None:
            with self._repository._session_factory() as session:
                record = session.get(SchemaConfigModel, schema_id)
                if record is None:
                    return None
                payload = record.config
                return SchemaConfig.model_validate(payload)
        return None

    def list_schemas(self) -> list[SchemaConfig]:
        if self._repository is not None:
            with self._repository._session_factory() as session:
                records = session.query(SchemaConfigModel).order_by(SchemaConfigModel.created_at).all()
                return [SchemaConfig.model_validate(record.config) for record in records]
        return []

    def update_schema(self, schema_id: str, updates: dict) -> SchemaConfig | None:
        schema = self.get_schema(schema_id)
        if schema is None:
            return None
        updated = schema.model_copy(update=updates)
        return self.create_schema(updated)

    def delete_schema(self, schema_id: str) -> bool:
        if self._repository is not None:
            with self._repository._session_factory() as session:
                with session.begin():
                    result = session.query(SchemaConfigModel).filter_by(id=schema_id).delete()
                    credential = session.get(SchemaCredentialModel, schema_id)
                    if credential is not None:
                        session.delete(credential)
            if result > 0:
                self._schema_passwords.pop(schema_id, None)
            return result > 0
        return False

    def create(self, spec: DashboardSpec) -> DashboardSpec:
        spec = self._without_live_query_data(spec)
        if self._repository is not None:
            return self._repository.save(spec)
        self._dashboards[spec.id] = spec
        return spec

    def get(self, dashboard_id: str) -> DashboardSpec | None:
        if self._repository is not None:
            return self._repository.get(dashboard_id)
        return self._dashboards.get(dashboard_id)

    def list(self) -> list[DashboardSpec]:
        if self._repository is not None:
            return self._repository.list()
        return list(self._dashboards.values())

    def update(self, dashboard_id: str, updates: dict) -> DashboardSpec | None:
        dashboard = self.get(dashboard_id)
        if dashboard is None:
            return None

        merged = {**dashboard.model_dump(mode="python"), **updates}
        updated = self._without_live_query_data(DashboardSpec.model_validate(merged))
        if self._repository is not None:
            return self._repository.save(updated)
        self._dashboards[dashboard_id] = updated
        return updated

    def delete(self, dashboard_id: str) -> bool:
        if self._repository is not None:
            return self._repository.delete(dashboard_id)
        return self._dashboards.pop(dashboard_id, None) is not None

    def get_widget(self, dashboard_id: str, widget_id: str) -> Optional[WidgetSpec]:
        dash = self.get(dashboard_id)
        if not dash:
            return None
        return next((w for w in dash.widgets if w.id == widget_id), None)

    @staticmethod
    def _without_live_query_data(spec: DashboardSpec) -> DashboardSpec:
        widgets = [
            widget.model_copy(update={"data": []})
            if widget.sql_connection and widget.sql_query
            else widget
            for widget in spec.widgets
        ]
        return spec.model_copy(update={"widgets": widgets})

    def resolve_drilldown(
        self, dashboard_id: str, widget_id: str, clicked_row: dict
    ) -> WidgetSpec:
        """Given the row/point a user clicked, produce the next-level
        WidgetSpec. Validates the widget declared drill_down, and that any
        referenced connection is allowlisted, before doing anything else."""
        widget = self.get_widget(dashboard_id, widget_id)
        if widget is None:
            raise ValueError(f"unknown widget {widget_id} on dashboard {dashboard_id}")
        dd = widget.drill_down
        if dd is None or not dd.enabled:
            raise ValueError(f"widget {widget_id} has no drill_down configured")

        key_values = {k: clicked_row.get(k) for k in dd.key_fields}

        if dd.sql_connection is not None:
            rows = self._execute_readonly(dd.sql_connection, dd.sql_query, key_values)
        else:
            # No live connection registered — fabricate a placeholder so the
            # frontend contract still resolves during development.
            rows = [{**key_values, "note": "no sql_connection configured; showing key fields only"}]

        title = dd.title_template.format(**{k: str(v) for k, v in key_values.items()})
        return WidgetSpec(
            id=f"drill_{uuid.uuid4().hex[:8]}",
            type=dd.result_widget_type,
            title=title,
            data=rows,
            position=widget.position,
        )

    def _execute_readonly(
        self, connection_name: str, query_template: Optional[str], params: dict
    ) -> list[dict]:
        """Execute a saved read query against a connected remote SQL source."""
        self._validate_read_query(query_template)

        schema = self.get_schema(connection_name)
        if schema is None:
            raise LookupError(f"SQL data source '{connection_name}' was not found")
        if schema.source_type.value != "remote_sql":
            raise PermissionError("Dashboard SQL can only run against remote SQL sources")
        if schema.status.value != "connected":
            raise PermissionError("The selected SQL data source is not connected")

        password = self.get_schema_password(connection_name)
        if password is None:
            raise PermissionError("The selected SQL data source has no saved credentials")

        engine = self._create_source_engine(schema, password)
        try:
            with engine.connect() as connection:
                with connection.begin():
                    if connection.dialect.name == "postgresql":
                        connection.exec_driver_sql("SET TRANSACTION READ ONLY")
                        connection.exec_driver_sql(
                            f"SET LOCAL statement_timeout = {QUERY_TIMEOUT_MS}"
                        )
                    result = connection.execute(text(query_template), params)
                    return [dict(row) for row in result.mappings().fetchmany(MAX_WIDGET_ROWS)]
        finally:
            engine.dispose()

    @classmethod
    def _validate_read_query(cls, query: Optional[str]) -> None:
        if not query or not _READ_QUERY_START.match(query):
            raise ValueError("Dashboard queries must be a single SELECT or WITH statement")
        if cls._has_multiple_statements(query):
            raise ValueError("Dashboard queries must contain exactly one SQL statement")

    @staticmethod
    def _has_multiple_statements(query: str) -> bool:
        quote: str | None = None
        line_comment = False
        block_comment = False
        semicolon_seen = False
        index = 0
        while index < len(query):
            char = query[index]
            following = query[index + 1] if index + 1 < len(query) else ""
            if line_comment:
                line_comment = char != "\n"
            elif block_comment:
                if char == "*" and following == "/":
                    block_comment = False
                    index += 1
            elif quote:
                if char == quote:
                    if following == quote:
                        index += 1
                    else:
                        quote = None
            elif char == "-" and following == "-":
                line_comment = True
                index += 1
            elif char == "/" and following == "*":
                block_comment = True
                index += 1
            elif char in {"'", '"'}:
                quote = char
            elif char == ";":
                if semicolon_seen and query[index + 1 :].strip():
                    return True
                semicolon_seen = True
            elif semicolon_seen and not char.isspace():
                return True
            index += 1
        return False

    @staticmethod
    def _create_source_engine(schema: SchemaConfig, password: str) -> Engine:
        metadata = schema.metadata
        db_type = str(metadata.get("dbType", "PostgreSQL")).strip().lower()
        if db_type not in {"postgresql", "postgres", "pg"}:
            raise PermissionError("Only PostgreSQL data sources can run dashboard SQL")
        host = str(metadata.get("host", "")).strip()
        database = str(metadata.get("database", "")).strip()
        username = str(metadata.get("username", "")).strip()
        if not host or not database or not username:
            raise ValueError("The SQL data source connection details are incomplete")

        url = URL.create(
            "postgresql+psycopg",
            username=username,
            password=password,
            host=host,
            port=int(metadata.get("port") or 5432),
            database=database,
            query={"sslmode": "require" if metadata.get("ssl") else "prefer"},
        )
        return create_engine(
            url,
            pool_pre_ping=True,
            connect_args={"connect_timeout": 10},
        )


dashboard_service = DashboardService()
