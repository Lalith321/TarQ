from __future__ import annotations

from fastapi import APIRouter, HTTPException
from sqlalchemy.exc import SQLAlchemyError

from app.models.schemas import DashboardSpec, DashboardUpdate, WidgetSpec
from app.services.dashboard_service import dashboard_service

router = APIRouter(prefix="/dashboards", tags=["dashboard"])


@router.get("/", response_model=list[DashboardSpec])
def list_dashboards():
    return dashboard_service.list()


@router.post("/", response_model=DashboardSpec)
def create_dashboard(spec: DashboardSpec):
    return dashboard_service.create(spec)


@router.get("/{dashboard_id}", response_model=DashboardSpec)
def get_dashboard(dashboard_id: str):
    dash = dashboard_service.get(dashboard_id)
    if dash is None:
        raise HTTPException(404, f"dashboard '{dashboard_id}' not found")
    return dash


@router.patch("/{dashboard_id}", response_model=DashboardSpec)
def update_dashboard(dashboard_id: str, updates: DashboardUpdate):
    if dashboard_service.get(dashboard_id) is None:
        raise HTTPException(404, f"dashboard '{dashboard_id}' not found")
    return dashboard_service.update(
        dashboard_id, updates.model_dump(exclude_unset=True)
    )


@router.delete("/{dashboard_id}", status_code=204)
def delete_dashboard(dashboard_id: str):
    if not dashboard_service.delete(dashboard_id):
        raise HTTPException(404, f"dashboard '{dashboard_id}' not found")


@router.post("/{dashboard_id}/widgets/{widget_id}/data")
def fetch_widget_data(dashboard_id: str, widget_id: str):
    """Execute a widget's saved query against its registered SQL source."""
    widget = dashboard_service.get_widget(dashboard_id, widget_id)
    if widget is None:
        raise HTTPException(404, f"widget '{widget_id}' not found")
    if not widget.sql_query:
        raise HTTPException(400, "widget has no sql_query")
    try:
        rows = dashboard_service._execute_readonly(
            widget.sql_connection or "", widget.sql_query, widget.sql_params
        )
        return {"data": rows}
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(403, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except SQLAlchemyError as exc:
        raise HTTPException(400, f"Widget SQL execution failed: {exc}") from exc


@router.post("/{dashboard_id}/widgets/{widget_id}/drilldown", response_model=WidgetSpec)
def drilldown(dashboard_id: str, widget_id: str, clicked_row: dict):
    try:
        return dashboard_service.resolve_drilldown(dashboard_id, widget_id, clicked_row)
    except PermissionError as exc:
        raise HTTPException(403, str(exc))
    except NotImplementedError as exc:
        raise HTTPException(501, str(exc))
    except ValueError as exc:
        raise HTTPException(404, str(exc))
