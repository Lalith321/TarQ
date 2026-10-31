"""
Data Analyst Node Module

Handles end-to-end data processing, SQL queries, sandbox computation,
and visualization. Integrates with GraphState to propagate produced CSVs
and Dashboard artifacts back to the Master Coordinator.
"""

import json
import os
from pathlib import Path
from typing import Dict, Any, List
from urllib.parse import quote_plus
from sqlalchemy import create_engine
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langchain_core.runnables import RunnableConfig
from langgraph.types import Command

from deepagents import create_deep_agent

# 1. Imports from your modular codebase
from .state import GraphState, active_task
from .sandbox import SandboxBackendFactory
from ..tools.dashboard_tool import dashboard_tool
from ..tools.run_python_sandbox_tool import create_run_python_sandbox_tool
from ..tools.sql_tool import create_sql_tools
from ..tools.train_ml_model_tool import train_ml_model
from ..tools.sagemaker_tool import manage_sagemaker_endpoint
from ..tools.dataset_profiler_tool import profile_dataset_file
from ..services.dashboard_service import dashboard_service
from ..routers.agent_configs import get_agent_config
from ..llm_config import create_chat_model
from ..core.workspace_paths import workspace_dir

# 2. Agent System Prompt with Sandbox & Artifact Guidelines
DATA_ANALYST_PROMPT = """You are the Data Analyst.
You are responsible for evidence-based data discovery, SQL retrieval, analysis,
and dashboard/widget artifacts assigned by the Master Coordinator. Follow the
active task and the user's stated scope; do not take over presentation/video
work assigned to the Narrator.

## Sources and tools
- Use only the selected databases and tables supplied in the task context.
    Treat that context as an allowlist; do not assume access to other sources.
- Inspect the available schema/listing tools when needed, then query only the
    columns and rows required for the task. SQL tool names may be source-prefixed.
- Use the stateful `run_python_sandbox` tool for reproducible pandas work,
    cleaning, statistical calculations, and checks on tool-provided data/files.
- Use the registered `dashboard_tool` to create a single widget or dashboard.
    Supply correct field names and widget types. For widgets intended to update
    with their source, include the selected source's `schema_id`, a reusable
    SELECT query, and bound `sql_params`; use `data` only as a chat preview.
    Set the standalone flag for a single chat widget; use a full dashboard
    only when the task asks for one.
- Use only paths returned by tools or paths explicitly available in the
    sandbox context. Do not claim a file or dashboard was saved unless the tool
    confirms it.

## Analysis standards
- Never fabricate observations, data, labels, statistics, or conclusions. A
    synthetic example is allowed only when the user explicitly requests sample
    data; label it clearly as synthetic and never present it as actual results.
- Compute every reported figure from retrieved data or reproducible code.
    Check row counts, nulls, units, date ranges, aggregation level, and relevant
    denominator before interpreting results. Avoid unsupported causal claims.
- Preserve the user's filters, time window, grouping, and definitions. If a
    material detail is missing and cannot be resolved from the schema or
    conversation, do not guess: report the exact blocker or clarification needed.
- Keep queries read-only and bounded to the task. Do not expose credentials or
    unrelated sensitive row-level data in the final response or artifacts.
- If data is empty, incomplete, contradictory, or unavailable, say so and
    describe its effect. Do not replace missing results with plausible values.

## Completion report
Return a concise, auditable summary of what was done, the key results and their
definitions, the data scope used, caveats, and any created artifact name/path.
Distinguish measured facts from interpretation. Explicitly report blockers; do
not claim completion when a required computation or artifact failed.
"""


# 3. Helper: Extract Artifacts from Tool Messages
def _extract_artifacts_from_tool_messages(
    messages: List[Any], dashboard_id: str | None = None
) -> Dict[str, str]:
    """
    Parses ToolMessage outputs from SandboxExportQuerySQLTool and create_dashboard
    to populate the shared state 'artifacts' registry (name -> path).
    """
    new_artifacts = {}

    for msg in messages:
        if not isinstance(msg, ToolMessage):
            continue

        # Extract SQL exported CSVs
        tool_name = msg.name or ""
        if tool_name.endswith("query_sql_database_tool"):
            try:
                payload = json.loads(msg.content)
                if payload.get("status") == "success" and "file_path" in payload:
                    filename = payload.get("filename", "sql_output.csv")
                    new_artifacts[filename] = payload["file_path"]
            except (json.JSONDecodeError, TypeError):
                pass

        # Extract Dashboard JSON artifacts
        elif tool_name in {"dashboard_tool", "create_dashboard"}:
            artifact = getattr(msg, "artifact", None)
            if isinstance(artifact, dict) and "id" in artifact:
                artifact_path = artifact.get("artifact_path") or artifact.get("path")
                if artifact_path:
                    key = f"dashboard_{dashboard_id}" if dashboard_id else f"dashboard_{artifact['id']}"
                    new_artifacts[key] = artifact_path
            else:
                try:
                    payload = json.loads(msg.content)
                    if "artifact" in payload:
                        art = payload["artifact"]
                        key = f"dashboard_{dashboard_id}" if dashboard_id else f"dashboard_{art['id']}"
                        new_artifacts[key] = art["path"]
                except (json.JSONDecodeError, TypeError):
                    pass

        # Extract files created in Python sandbox
        elif tool_name == "run_python_sandbox":
            try:
                payload = json.loads(msg.content)
                for created_file in payload.get("files_created") or []:
                    fname = Path(created_file).name
                    if fname:
                        new_artifacts[fname] = str(created_file)
            except (json.JSONDecodeError, TypeError):
                pass

    return new_artifacts


# 4. Instantiate Tools and Deep Agent
_backend_dir = Path(__file__).resolve().parents[2]
_sandbox_dir = workspace_dir() / "analyst_sandbox"

# Use the same backend interface as the Narrator. Subprocess is a deliberate
# local-development default; deployed environments select SANDBOX_BACKEND.
_sandbox_backend_name = os.getenv("SANDBOX_BACKEND", "subprocess")
_sandbox_backend_kwargs = (
    {"workspace": str(_sandbox_dir)}
    if _sandbox_backend_name == "subprocess"
    else {}
)
_sandbox_backend = SandboxBackendFactory.create(
    _sandbox_backend_name, **_sandbox_backend_kwargs
).start()
sandbox_toolset = [create_run_python_sandbox_tool(_sandbox_backend)]

def _create_schema_engine(schema, password: str):
    metadata = schema.metadata
    db_type = str(metadata.get("dbType", "PostgreSQL")).strip().lower()
    if db_type not in {"postgresql", "postgres", "pg"}:
        raise ValueError(f"Unsupported database type for schema '{schema.name}'")

    username = quote_plus(str(metadata.get("username", "")).strip())
    encoded_password = quote_plus(password)
    host = str(metadata.get("host", "")).strip()
    port = str(metadata.get("port", "5432")).strip() or "5432"
    database = str(metadata.get("database", "")).strip()
    if not host or not database:
        raise ValueError(f"Connection details for schema '{schema.name}' are incomplete")

    sslmode = "require" if metadata.get("ssl") else "prefer"
    url = (
        f"postgresql+psycopg://{username}:{encoded_password}@{host}:{port}/"
        f"{database}?sslmode={sslmode}"
    )
    return create_engine(url, pool_pre_ping=True, connect_args={"connect_timeout": 10})


# 5. LangGraph Node Function
def data_analyst_node(state: GraphState, config: RunnableConfig) -> Command:
    """
    Data Analyst Execution Node:
    - Resolves active task or current_task from GraphState.
    - Executes the Deep Agent loop.
    - Aggregates newly created CSVs/Dashboards into GraphState.artifacts.
    - Routes back to Master Coordinator.
    """
    # Resolve active task description dynamically
    task_desc = state.get("current_task")
    if not task_desc and "todo" in state:
        current_todo = active_task(state["todo"], "Data Analyst")
        task_desc = current_todo["description"] if current_todo else "Execute data analysis task."

    existing_artifacts = state.get("artifacts", {})
    configurable = config.get("configurable", {})
    fleet_id = configurable.get("fleet_id")
    dashboard_id = configurable.get("dashboard_id") or state.get("dashboard_id")
    selected_sources = state.get("selected_sources", [])
    sql_tools = []
    engines = []
    source_context = []

    for index, selection in enumerate(selected_sources):
        schema_id = selection["schema_id"]
        schema = dashboard_service.get_schema(schema_id)
        password = dashboard_service.get_schema_password(schema_id)
        if schema is None or password is None:
            raise ValueError(f"Selected schema '{schema_id}' is no longer available")

        selected_tables = selection["tables"]
        source_context.append({"schema_id": schema.id, "database": schema.name, "tables": selected_tables})
        if not selected_tables:
            continue

        engine = _create_schema_engine(schema, password)
        engines.append(engine)
        tables_by_schema: dict[str | None, list[str]] = {}
        for table_name in selected_tables:
            if "." in table_name:
                table_schema, bare_table_name = table_name.split(".", 1)
            else:
                table_schema, bare_table_name = None, table_name
            tables_by_schema.setdefault(table_schema, []).append(bare_table_name)

        for schema_index, (table_schema, table_names) in enumerate(tables_by_schema.items()):
            scope_name = table_schema or "default"
            sql_tools.extend(
                create_sql_tools(
                    engine=engine,
                    include_tables=table_names,
                    schema=table_schema,
                    sandbox_dir=str(_sandbox_dir),
                    sandbox_backend=_sandbox_backend,
                    tool_name_prefix=f"source_{index + 1}_{scope_name}_{schema_index + 1}",
                )
            )

    data_analyst_agent = create_deep_agent(
        name="Data Analyst",
        model=create_chat_model(configurable.get("model_settings")),
        tools=[*sql_tools, *sandbox_toolset, dashboard_tool, train_ml_model, manage_sagemaker_endpoint, profile_dataset_file],
        system_prompt=(
            f"{DATA_ANALYST_PROMPT}\n\n"
            f"Additional configured instructions: {get_agent_config('analyst', fleet_id).instructions}"
        ),
    )

    from ..routers.artifacts import ARTIFACT_DIR, register_artifact
    pre_existing_artifact_files = (
        {p.name for p in ARTIFACT_DIR.iterdir() if p.is_file()}
        if ARTIFACT_DIR.is_dir()
        else set()
    )

    # Construct context task message
    task_prompt = (
        f"Active Task: {task_desc}\n"
        f"Active Dashboard ID: {dashboard_id or 'standalone'}\n"
        f"User Instructions: {state.get('messages', [])[-1]}\n"
        f"Selected SQL databases and tables: {json.dumps(source_context, indent=2)}\n"
        f"Available Host/Sandbox Artifacts: {json.dumps(existing_artifacts, indent=2)}"
    )

    # Run agent execution
    try:
        result = data_analyst_agent.invoke({"messages": [HumanMessage(content=task_prompt)]})
    finally:
        for engine in engines:
            engine.dispose()

    # Register any newly created files in ARTIFACT_DIR for this dashboard
    if dashboard_id and ARTIFACT_DIR.is_dir():
        for file_path in ARTIFACT_DIR.iterdir():
            if (
                file_path.is_file()
                and file_path.name != "MANIFEST.json"
                and file_path.name not in pre_existing_artifact_files
            ):
                register_artifact(file_path.name, dashboard_id=dashboard_id)

    # Extract new artifacts and update dictionary
    discovered_artifacts = _extract_artifacts_from_tool_messages(
        result["messages"], dashboard_id=dashboard_id
    )
    updated_artifacts = {**existing_artifacts, **discovered_artifacts}
    analyst_report = result["messages"][-1]
    if isinstance(analyst_report, AIMessage):
        analyst_report = analyst_report.model_copy(update={"name": "Data Analyst"})

    return Command(
        goto="Master Coordinator",
        update={
            "messages": [analyst_report],
            "artifacts": updated_artifacts,
        },
    )
