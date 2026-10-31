from __future__ import annotations

from contextlib import asynccontextmanager
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

from app.db.database import init_db
from app.core.tarq_coord import close_checkpointer_pool, get_checkpointer
from app.models.schemas import (
    DashboardSpec, WidgetSpec, WidgetType, WidgetPosition,
    GisConfig, GisGeometry, DrillDownConfig,
)
from app.routers import agent_configs, analyst, artifacts, dashboard, documents, context, ml, schema, logs, sagemaker, datasets
from app.services.dashboard_service import dashboard_service

@asynccontextmanager
async def lifespan(_: FastAPI):
    await get_checkpointer()
    try:
        yield
    finally:
        await close_checkpointer_pool()


app = FastAPI(
    title="Data Analysis API",
    description="Data analysis and insight generation service.",
    version="0.1.0",
    lifespan=lifespan,
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
app.include_router(analyst.router)
app.include_router(agent_configs.router)
app.include_router(dashboard.router)
app.include_router(artifacts.router)
app.include_router(documents.router)
app.include_router(context.router)
app.include_router(ml.router)
app.include_router(sagemaker.router)
app.include_router(datasets.router)
app.include_router(schema.router)
app.include_router(logs.router)


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

    tiled_cluster_widget = WidgetSpec(
        id="w_tiled_cluster",
        type=WidgetType.TILED_STRUCTURE,
        title="High-Dimensional Single-Cell Latent Clusters",
        data=[
            {"umap_1": -3.2, "umap_2": 2.8, "cluster": "CD8+ Effector T", "label": "CD8+ T-Cell"},
            {"umap_1": -2.7, "umap_2": 3.1, "cluster": "CD8+ Effector T", "label": "CD8+ Memory"},
            {"umap_1": -3.0, "umap_2": 2.5, "cluster": "CD8+ Effector T", "label": "CD8+ Exhausted"},
            {"umap_1": 4.1, "umap_2": -1.2, "cluster": "CD19+ B-Cell", "label": "Follicular B-Cell"},
            {"umap_1": 4.5, "umap_2": -1.6, "cluster": "CD19+ B-Cell", "label": "Memory B-Cell"},
            {"umap_1": 0.2, "umap_2": -4.1, "cluster": "CD14+ Monocyte", "label": "Classical Monocyte"},
            {"umap_1": 0.6, "umap_2": -3.8, "cluster": "CD14+ Monocyte", "label": "Non-classical Monocyte"},
            {"umap_1": 1.8, "umap_2": 3.6, "cluster": "NK Cells", "label": "CD56dim NK"},
            {"umap_1": 2.1, "umap_2": 3.9, "cluster": "NK Cells", "label": "CD56bright NK"},
        ],
        x_field="umap_1",
        y_field="umap_2",
        group_by="cluster",
        position=WidgetPosition(x=0, y=4, w=12, h=5),
    )

    dashboard_service.create(
        DashboardSpec(
            id="demo",
            title="Analysis Overview",
            description="Sample analysis summary with key metrics, real-time spatial tiling, and recent results.",
            widgets=[agent_cost_widget, success_rate_widget, recent_runs_widget, tiled_cluster_widget],
        )
    )


init_db()
_seed_demo_dashboard()
