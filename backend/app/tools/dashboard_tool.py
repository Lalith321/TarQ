import json
import os
import uuid
from typing import Annotated, Any
from langchain_core.tools import tool
from ..core.workspace_paths import workspace_dir

_scratch_dir = str(workspace_dir() / "dashboard_scratch")
os.makedirs(_scratch_dir, exist_ok=True)


@tool(response_format="content_and_artifact")
def dashboard_tool(
    title: Annotated[str, "Dashboard or single-widget title"],
    widgets: Annotated[
        list[dict[str, Any]],
        (
            "List of widgets to render. Each widget is an object with:\n"
            "- id: str (unique within the dashboard)\n"
            "- type: one of 'bar', 'stacked_bar', 'line', 'multi_line', 'pie', 'area', 'table', 'stat', 'gis', 'scatter', 'manhattan', 'volcano', 'heatmap', 'tiled_structure'\n"
            "- title: str (widget heading)\n"
            "- data: optional list[dict] (row preview; live SQL-backed dashboards fetch current rows)\n"
            "- x_field: str (key in each data row for x-axis/category; omit for 'gis')\n"
            "- y_field: str | list[str] (key(s) in each data row for y-axis/values; omit for 'gis')\n"
            "- group_by: optional str (key used to split data into multiple series or groups)\n"
            "  * For 'multi_line': x_field is category/date, group_by is series label, y_field is numeric measure.\n"
            "  * For 'scatter' (PCA / t-SNE / XY correlation): x_field is X coordinate (e.g. pc1), y_field is Y coordinate (e.g. pc2), group_by is optional cluster/population label. Supports real-time spatial tiling switch.\n"
            "  * For 'tiled_structure' (Spatial Quadtree & LoD Virtual Canvas): x_field is X coordinate (umap_1, lon, x), y_field is Y coordinate (umap_2, lat, y), group_by is cluster/element/type. Modes auto-detected from title or data ('clusters', 'graph', 'map', 'molecular' with CPK coloring and valence bonds).\n"
            "  * For 'manhattan' (GWAS): x_field is genomic position (or chromosome), y_field is p-value (or -log10 p), group_by is chromosome.\n"
            "  * For 'volcano' (differential expression): x_field is log2 fold-change, y_field is p-value/padj (or -log10 p), group_by is gene/feature symbol.\n"
            "  * For 'heatmap' (expression / LD matrix): either long-form (x_field=column, group_by=row, y_field=value) or wide-form (x_field=row label, y_field=list of numeric column keys).\n"
            "- color: optional str (hex code or theme token for primary series)\n\n"
            "GIS Configuration (REQUIRED when type is 'gis'):\n"
            "  Object containing:\n"
            "  - lat_field: str (key holding latitude in data)\n"
            "  - lng_field: str (key holding longitude in data)\n"
            "  - geometry: 'point' | 'heatmap' | 'choropleth' | 'polygon' | 'trajectory' (default 'point')\n"
            "      * 'point': plots one marker per row\n"
            "      * 'heatmap': scales marker size/opacity by weight_field as a density approximation\n"
            "      * 'choropleth' / 'polygon': shades regions; uses boundary_geojson_url or geojson_data\n"
            "      * 'trajectory': connects ordered points with a path line (e.g. migration/lineage route)\n"
            "  - weight_field: optional str (numeric key used to size/color heatmap markers)\n"
            "  - region_id_field: optional str (key used to join rows to boundary_geojson_url features)\n"
            "  - boundary_geojson_url: optional str (URL to static GeoJSON of region boundaries; required for 'choropleth')\n"
            "  - tooltip_fields: optional list[str] (row keys shown in marker tooltip)\n\n"
            "Drill-Down Configuration (OPTIONAL on any widget type):\n"
            "  Object declaring this widget is clickable to reveal a deeper slice:\n"
            "  - enabled: bool (default true)\n"
            "  - key_fields: list[str] (fields from clicked row identifying what was clicked, e.g. ['agent_name'])\n"
            "  - sql_connection: optional str (allowlisted read-only connection name)\n"
            "  - sql_query: optional str (parameterized SELECT using placeholders, e.g. 'SELECT * FROM runs WHERE agent_name = :agent_name')\n"
            "  - result_widget_type: one of the type values above (default 'table')\n"
            "  - title_template: str (title template with placeholders, e.g. 'Runs for {agent_name}')\n\n"
            "Metadata & Refresh:\n"
            "- sql_connection: optional str (selected SQL source schema_id, as supplied in task context)\n"
            "- sql_query: optional str (one reusable SELECT/WITH query; use :name placeholders)\n"
            "- sql_params: optional object (values bound to the query placeholders)\n"
            "- position: optional object with x, y, w, h integers describing grid placement"
        ),
    ],
    description: Annotated[str, "Optional dashboard summary or subtitle"] = "",
    is_standalone_widget: Annotated[
        bool,
        "Set to True if rendering a single standalone chart directly in chat. "
        "Set to False if compiling a full multi-widget dashboard view.",
    ] = False,
) -> tuple[str, dict[str, Any]]:
    """Emit a structured dashboard configuration made of one or more widgets,
    including geospatial (GIS) widgets and drill-down-enabled widgets.

    GIS Guidance:
    - GIS is opt-in, not a default. Most dashboards (cost, usage, workflow, agent-ops)
      have no location dimension and should contain zero 'gis' widgets—only add one
      when the domain genuinely has geospatial data (facilities, regional load, incident maps).
    - Every row needs latitude/longitude (or region_id for choropleth) present in `data`.
      This tool does NOT geocode place names to coordinates.
    - Default geometry to 'point' unless asked about density ('heatmap') or administrative regions ('choropleth').

    Drill-down Guidance:
    - Add `drill_down` to any widget the user might reasonably want to click for deeper insight
      (e.g., clicking an agent on a cost chart to view that agent's individual runs).
        - For live dashboard widgets, set `sql_connection` to a selected source `schema_id`
            provided in the task context and supply a read-only `sql_query`. Never guess a source ID.
            Use `sql_params` for bound values; never interpolate values into SQL text.
    - Drill-downs can nest: a drill-down result widget can itself declare a `drill_down`.

    Usage & Data Execution:
    - Call this tool when a user asks for a chart, graph, KPI, map, or dashboard and verified data is available.
    - If required data or a material definition is missing, do not invent values; report the blocker or ask for clarification.
    - Use synthetic data only when the user explicitly requests a sample or demo, and label it clearly as synthetic. For GIS, use real, accurate coordinates.
        - Put labels and layout in the tool call. Include source SQL for live dashboards; raw `data`
            rows are appropriate for standalone chat previews or when no live source query is available.
    - For grouped multi-line charts, return one row per x_field and group_by combination, aggregate the requested measure in SQL, set group_by to the company/category field, and set y_field to the numeric measure. The renderer creates one line per group.
    - Set `is_standalone_widget=True` when rendering a single chart in chat; set `False` for full dashboards.
    """
    dashboard_id = uuid.uuid4().hex
    artifact_path = os.path.join(_scratch_dir, f"dashboard_{dashboard_id}.json")

    from ..models.schemas import WidgetSpec

    validated_widgets: list[dict[str, Any]] = []
    for index, raw_widget in enumerate(widgets):
        normalised = dict(raw_widget)
        normalised.setdefault("id", f"widget_{uuid.uuid4().hex[:8]}")
        normalised.setdefault(
            "position",
            {"x": (index % 2) * 6, "y": (index // 2) * 4, "w": 6, "h": 4},
        )
        validated_widgets.append(
            WidgetSpec.model_validate(normalised).model_dump(mode="json")
        )

    payload = {
        "id": dashboard_id,
        "title": title,
        "description": description,
        "is_standalone_widget": is_standalone_widget,
        "widget_count": len(validated_widgets),
        "widgets": validated_widgets,
    }

    # Save to scratch path as persistent artifact
    with open(artifact_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    payload["artifact_path"] = artifact_path

    if is_standalone_widget:
        summary_msg = f"Widget '{title}' rendered successfully."
    else:
        summary_msg = f"Dashboard '{title}' ready with {len(validated_widgets)} widget(s). id={dashboard_id}"

    return summary_msg, payload