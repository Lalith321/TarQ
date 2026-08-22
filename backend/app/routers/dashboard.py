from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models.schemas import DashboardSpec, WidgetSpec
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
