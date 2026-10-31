from __future__ import annotations

import re
from typing import Optional

from fastapi import APIRouter, Body, File, HTTPException, Query, UploadFile
from fastapi.responses import Response
from sqlalchemy.exc import SQLAlchemyError

from app.models.schemas import DashboardSpec, DashboardUpdate, WidgetSpec
from app.routers.artifacts import (
    delete_artifact,
    delete_dashboard_input,
    list_artifacts,
    list_dashboard_inputs,
    upload_dashboard_input,
)
from app.services.dashboard_service import dashboard_service
from app.services.report_service import generate_dashboard_report_pdf

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


def _build_report_response(
    dashboard_id: str,
    spec_override: Optional[DashboardSpec] = None,
    download: bool = True,
) -> Response:
    dash = spec_override or dashboard_service.get(dashboard_id)
    if dash is None:
        raise HTTPException(404, f"dashboard '{dashboard_id}' not found")

    resolved_widgets: list[WidgetSpec] = []
    for w in dash.widgets:
        w_copy = w.model_copy(deep=True)
        if not w_copy.data and w_copy.sql_query:
            try:
                rows = dashboard_service._execute_readonly(
                    w_copy.sql_connection or "", w_copy.sql_query, w_copy.sql_params
                )
                w_copy.data = rows
            except Exception:
                pass
        resolved_widgets.append(w_copy)

    resolved_dash = dash.model_copy(update={"widgets": resolved_widgets})
    outputs = list_artifacts(dashboard_id=dashboard_id)
    pdf_bytes = generate_dashboard_report_pdf(resolved_dash, artifacts=outputs)

    safe_slug = re.sub(r"[^a-zA-Z0-9_-]+", "_", (resolved_dash.title or "dashboard").strip()).strip("_").lower() or "dashboard"
    filename = f"{safe_slug}_report.pdf"
    disposition_type = "attachment" if download else "inline"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'{disposition_type}; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )


@router.get("/{dashboard_id}/report.pdf")
def get_dashboard_report_pdf(
    dashboard_id: str,
    download: bool = Query(default=True, description="Whether to force attachment download or inline view"),
):
    """Generate and return a multi-page PDF executive report for the dashboard."""
    return _build_report_response(dashboard_id, spec_override=None, download=download)


@router.post("/{dashboard_id}/report.pdf")
def post_dashboard_report_pdf(
    dashboard_id: str,
    spec: Optional[DashboardSpec] = Body(default=None),
    download: bool = Query(default=True),
):
    """Generate a multi-page PDF executive report from the provided live DashboardSpec (or stored spec)."""
    return _build_report_response(dashboard_id, spec_override=spec, download=download)


@router.get("/{dashboard_id}/media")
def get_dashboard_media(dashboard_id: str):
    """List generated media/outputs belonging strictly to this dashboard."""
    return list_artifacts(dashboard_id=dashboard_id)


@router.delete("/{dashboard_id}/media/{media_id}", status_code=204)
def remove_dashboard_media(dashboard_id: str, media_id: str):
    """Delete a generated media/output artifact belonging to this dashboard."""
    delete_artifact(filename=media_id, dashboard_id=dashboard_id)
    return Response(status_code=204)


@router.get("/{dashboard_id}/uploads")
def get_dashboard_uploads(dashboard_id: str):
    """List input files uploaded specifically to this dashboard."""
    return list_dashboard_inputs(dashboard_id=dashboard_id)


@router.post("/{dashboard_id}/uploads")
async def create_dashboard_upload(dashboard_id: str, file: UploadFile = File(...)):
    """Upload an input file scoped specifically to this dashboard."""
    return await upload_dashboard_input(dashboard_id=dashboard_id, file=file)


@router.delete("/{dashboard_id}/uploads/{upload_id}", status_code=204)
def remove_dashboard_upload(dashboard_id: str, upload_id: str):
    """Delete an uploaded input file belonging to this dashboard."""
    delete_dashboard_input(input_id=upload_id, dashboard_id=dashboard_id)
    return Response(status_code=204)

