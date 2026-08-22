"""
In-memory (swap for the SQLAlchemy models in db/database.py once persistence
matters) store for DashboardSpecs, plus drill-down resolution.

Drill-down resolution is deliberately conservative: it only ever runs a
query against a connection name present in ALLOWED_CONNECTIONS, using
SQLAlchemy bound parameters (never string interpolation), and only against
queries that were registered on the widget itself — a drill-down can never
run arbitrary caller-supplied SQL. No real connections are wired up in this
build (no credentials, per instruction) — see LIMITATIONS.md for what a
production version needs.
"""
from __future__ import annotations

import uuid
from typing import Optional

from app.models.schemas import DashboardSpec, WidgetSpec, WidgetType

# Allowlist of connection *names* a drill_down.sql_connection may reference.
# Actual engine/credentials wiring is intentionally left as a TODO.
ALLOWED_CONNECTIONS: set[str] = {"analytics_ro", "agent_runs_ro"}


class DashboardService:
    def __init__(self) -> None:
        self._dashboards: dict[str, DashboardSpec] = {}

    def create(self, spec: DashboardSpec) -> DashboardSpec:
        self._dashboards[spec.id] = spec
        return spec

    def get(self, dashboard_id: str) -> Optional[DashboardSpec]:
        return self._dashboards.get(dashboard_id)

    def list(self) -> list[DashboardSpec]:
        return list(self._dashboards.values())

    def get_widget(self, dashboard_id: str, widget_id: str) -> Optional[WidgetSpec]:
        dash = self.get(dashboard_id)
        if not dash:
            return None
        return next((w for w in dash.widgets if w.id == widget_id), None)

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
            if dd.sql_connection not in ALLOWED_CONNECTIONS:
                raise PermissionError(
                    f"connection '{dd.sql_connection}' is not in ALLOWED_CONNECTIONS"
                )
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
        """Placeholder execution path. Wire this to a real read-only
        SQLAlchemy engine per connection_name; keep using bound params
        (`:param_name`) — never str.format the SQL itself with user data."""
        if query_template is None:
            return [params]
        # NOTE: no engine is registered in this build (no credentials
        # provided). This raises so the gap is visible instead of silently
        # returning fake rows for a query someone thinks is live.
        raise NotImplementedError(
            f"no engine registered for connection '{connection_name}' — "
            "wire one up in db/database.py before this drill-down can run for real"
        )


dashboard_service = DashboardService()
