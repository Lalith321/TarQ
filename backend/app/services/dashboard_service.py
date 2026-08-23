from __future__ import annotations

import uuid
from typing import Optional, Any
from sqlalchemy import text, select
from sqlalchemy.orm import Session

from app.models.schemas import DashboardSpec, WidgetSpec
from db.database import DashboardModel


class DashboardService:
    def __init__(self, db_session: Session, db_engines: Optional[dict[str, Any]] = None) -> None:
        """
        :param db_session: Primary SQLAlchemy session for dashboard metadata (CRUD)
        :param db_engines: Dictionary mapping connection names (e.g., 'analytics_db') 
                           to SQLAlchemy Engine instances.
        """
        self.db = db_session
        self.db_engines = db_engines or {}

    def create(self, spec: DashboardSpec, user_id: str) -> DashboardSpec:
        """Saves a new dashboard spec into the PostgreSQL JSONB column."""
        db_dashboard = DashboardModel(
            id=spec.id,
            user_id=user_id,
            title=spec.title,
            spec=spec.model_dump(mode="json"),
        )
        self.db.add(db_dashboard)
        self.db.commit()
        self.db.refresh(db_dashboard)
        return spec

    def get(self, dashboard_id: str) -> Optional[DashboardSpec]:
        """Retrieves and parses the DashboardSpec JSONB payload from PostgreSQL."""
        stmt = select(DashboardModel).where(DashboardModel.id == dashboard_id)
        result = self.db.execute(stmt).scalar_one_or_none()
        
        if not result:
            return None
        
        return DashboardSpec.model_validate(result.spec)

    def list(self, user_id: str) -> list[DashboardSpec]:
        """Lists all dashboards belonging to a user."""
        stmt = select(DashboardModel).where(DashboardModel.user_id == user_id)
        results = self.db.execute(stmt).scalars().all()
        return [DashboardSpec.model_validate(row.spec) for row in results]

    def get_widget(self, dashboard_id: str, widget_id: str) -> Optional[WidgetSpec]:
        """Fetches dashboard from DB and extracts the requested widget from JSONB."""
        dash = self.get(dashboard_id)
        if not dash:
            return None
        return next((w for w in dash.widgets if w.id == widget_id), None)

    def resolve_drilldown(
        self, dashboard_id: str, widget_id: str, clicked_row: dict
    ) -> WidgetSpec:
        """Executes the pre-verified drilldown query for a widget."""
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
            rows = [{**key_values, "note": "no sql_connection configured; showing key fields only"}]

        title = dd.title_template.format(**{k: str(v) for k, v in key_values.items() if v is not None})
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
        """Executes a pre-verified query directly against the specified target engine."""
        if query_template is None:
            return [params]

        engine = self.db_engines.get(connection_name)
        if engine is None:
            raise KeyError(
                f"no database engine registered for connection name '{connection_name}'"
            )

        with engine.connect() as conn:
            result = conn.execute(text(query_template), params)
            return [dict(row._mapping) for row in result]