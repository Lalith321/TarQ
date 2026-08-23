"""
Shared contract between the backend, the frontend, and the `dashboard_tool`
that an LLM agent calls. Keeping this in one place means the tool schema,
the API response, and the TypeScript types (services/types.ts on the
frontend) can never quietly drift apart — the frontend types file is a
hand-mirrored copy of this file, and any change here should be mirrored there.
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class WidgetType(str, Enum):
    BAR = "bar"
    LINE = "line"
    PIE = "pie"
    AREA = "area"
    TABLE = "table"
    STAT = "stat"
    GIS = "gis"  # new


class GisGeometry(str, Enum):
    """How to render geospatial rows."""
    POINT = "point"          # one marker per row
    HEATMAP = "heatmap"      # density surface over point weight
    CHOROPLETH = "choropleth"  # shaded regions, needs boundary_geojson_url


class GisConfig(BaseModel):
    lat_field: str
    lng_field: str
    geometry: GisGeometry = GisGeometry.POINT
    weight_field: Optional[str] = None       # for heatmap intensity
    region_id_field: Optional[str] = None    # for choropleth join key
    boundary_geojson_url: Optional[str] = None  # static asset, not fetched live
    tooltip_fields: list[str] = Field(default_factory=list)


class DrillDownConfig(BaseModel):
    """
    Declares that clicking a data point/row on this widget should fetch a
    deeper slice. The frontend never hardcodes what "deeper" means per widget
    type — it POSTs the clicked row's key fields to
    `/dashboards/{id}/widgets/{widget_id}/drilldown` and renders whatever
    shape comes back (another WidgetSpec, so drill-downs can nest).

    sql_query is a template with named placeholders, e.g.
        "SELECT * FROM agent_runs WHERE agent_name = :agent_name LIMIT 200"
    Only registered, read-only, allowlisted connections may be referenced by
    sql_connection — see dashboard_service.ALLOWED_CONNECTIONS. This is a
    stub in this build; see LIMITATIONS.md.
    """
    enabled: bool = True
    key_fields: list[str]                 # which fields from the clicked row to pass on
    sql_connection: Optional[str] = None
    sql_query: Optional[str] = None
    result_widget_type: WidgetType = WidgetType.TABLE
    title_template: str = "Details"       # may reference {key_field} placeholders


class WidgetPosition(BaseModel):
    x: int
    y: int
    w: int
    h: int


class WidgetSpec(BaseModel):
    id: str
    type: WidgetType
    title: str
    data: list[dict[str, Any]] = Field(default_factory=list)
    x_field: Optional[str] = None
    y_field: Optional[str | list[str]] = None
    group_by: Optional[str] = None
    color: Optional[str] = None
    gis: Optional[GisConfig] = None                 # required when type == GIS
    drill_down: Optional[DrillDownConfig] = None
    sql_connection: Optional[str] = None
    sql_query: Optional[str] = None
    position: WidgetPosition


class DashboardSpec(BaseModel):
    id: str
    title: str
    description: str = ""
    widgets: list[WidgetSpec] = Field(default_factory=list)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# ── Document insight extraction ────────────────────────────────────────────

class ExtractedMetric(BaseModel):
    label: str
    value: str
    unit: Optional[str] = None


class InsightBundle(BaseModel):
    """
    Output of the format-agnostic insight extraction pipeline. Every field is
    optional/empty-safe because a chunk of an unstructured document may
    simply not contain, say, any risks — the merge step never assumes a
    field is populated.
    """
    source_file: str
    summary: str = ""
    entities: list[str] = Field(default_factory=list)
    metrics: list[ExtractedMetric] = Field(default_factory=list)
    action_items: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    chunk_count: int = 0
    low_confidence: bool = False  # set true if extraction fell back to heuristics


# ── Context management ─────────────────────────────────────────────────────

class ConversationTurn(BaseModel):
    role: str  # "user" | "assistant" | "tool"
    content: str
    tokens: int
    created_at: datetime = Field(default_factory=datetime.utcnow)


class MemoryBlock(BaseModel):
    """A compressed summary standing in for turns that were evicted."""
    summary: str
    covers_turns: int
    tokens: int
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ContextSnapshot(BaseModel):
    """What build_context() hands back to the caller: ready-to-send messages."""
    messages: list[dict[str, str]]
    memory_blocks_used: int
    artifacts_referenced: list[str]
    estimated_tokens: int
