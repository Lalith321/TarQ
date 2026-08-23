from __future__ import annotations

import sys
from pathlib import Path

if __package__ in {None, ""}:
    backend_dir = Path(__file__).resolve().parent.parent
    repo_root = backend_dir.parent
    for candidate in (str(backend_dir), str(repo_root)):
        if candidate not in sys.path:
            sys.path.insert(0, candidate)

try:
    from app.routers import chat
except ModuleNotFoundError:  # pragma: no cover - fallback for repo-root imports
    from app.routers import chat

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.models.schemas import (
    DashboardSpec, WidgetSpec, WidgetType, WidgetPosition,
    GisConfig, GisGeometry, DrillDownConfig,
)
from app.routers import agent, dashboard, documents, context, ml
from app.services.dashboard_service import dashboard_service

app = FastAPI(
    title="Data Analysis API",
    description="Data analysis and insight generation service.",
    version="0.1.0",
)

# Wide open CORS since there's no auth layer yet; tighten this the same day
# auth is added.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router)
app.include_router(agent.router)
app.include_router(dashboard.router)
app.include_router(documents.router)
app.include_router(context.router)
app.include_router(ml.router)


@app.get("/health")
def health():
    return {"status": "ok"}



#TO BE REMOVED IN PROD
def _seed_demo_dashboard() -> None:
    """The DEFAULT seeded dashboard — deliberately has NO geospatial widget.
    GIS is one widget type among seven (see WidgetType), not a default
    fixture of every dashboard: most agent/ops dashboards have no location
    dimension at all, so this one models that common case. A separate
    dashboard below ("demo-gis") shows the opt-in geospatial case instead of
    folding it into every seed."""
    agent_cost_widget = WidgetSpec(
        id="w_agent_cost",
        type=WidgetType.BAR,
        title="Cost by Agent",
        data=[
            {"agent_name": "swing-trade-research", "total_cost": 4.21},
            {"agent_name": "insight-extractor", "total_cost": 1.85},
            {"agent_name": "mcp-portfolio", "total_cost": 0.92},
        ],
        x_field="agent_name",
        y_field="total_cost",
        drill_down=DrillDownConfig(
            key_fields=["agent_name"],
            sql_connection="agent_runs_ro",
            sql_query="SELECT * FROM agent_runs WHERE agent_name = :agent_name ORDER BY timestamp DESC LIMIT 200",
            result_widget_type=WidgetType.TABLE,
            title_template="Runs for {agent_name}",
        ),
        position=WidgetPosition(x=0, y=0, w=6, h=4),
    )

    success_rate_widget = WidgetSpec(
        id="w_success_rate",
        type=WidgetType.STAT,
        title="Success Rate",
        data=[{"rate": "94%"}],
        y_field="rate",
        position=WidgetPosition(x=6, y=0, w=3, h=2),
    )

    recent_runs_widget = WidgetSpec(
        id="w_recent_runs",
        type=WidgetType.TABLE,
        title="Recent Runs",
        data=[
            {"agent_name": "swing-trade-research", "status": "completed", "tokens": 4210},
            {"agent_name": "insight-extractor", "status": "completed", "tokens": 1850},
        ],
        position=WidgetPosition(x=6, y=2, w=6, h=2),
    )

    dashboard_service.create(
        DashboardSpec(
            id="demo",
            title="Analysis Overview",
            description="Sample analysis summary with key metrics and recent results.",
            widgets=[agent_cost_widget, success_rate_widget, recent_runs_widget],
        )
    )


_seed_demo_dashboard()
