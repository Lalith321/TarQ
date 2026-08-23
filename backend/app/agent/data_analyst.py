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
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, ToolMessage
from langgraph.types import Command

from deepagents import create_deep_agent

# 1. Imports from your modular codebase
from .state import GraphState, active_task
from .sandbox import SandboxBackendFactory
from ..tools.dashboard_tool import dashboard_tool
from ..tools.run_python_sandbox_tool import create_run_python_sandbox_tool
from ..tools.sql_tool import create_sql_tools

# 2. Agent System Prompt with Sandbox & Artifact Guidelines
DATA_ANALYST_PROMPT = """You are the Data Analyst.
You handle technical data extraction, pandas analysis, and visualization as directed by the Master Coordinator.

Tools & Execution Rules:
1. SQL Database Tools:
   - Execute `query_sql_database_tool` to run queries. Full outputs automatically export to CSV in the sandbox scratch directory, returning preview metadata to you.
2. Sandbox Tools (`run_python_sandbox`):
   - Perform stateful pandas manipulations, data cleaning, or statistical calculations directly on generated CSVs inside `/workspace` or `sandbox_data/`.
3. Visualization Tools:
   - `create_widget`: Use for single charts/metrics.
   - `create_dashboard`: Use ONLY when instructed to build a full dashboard. Every widget passed must reference its source SQL query.

Never fabricate data. Always run SQL or Python code to compute figures before returning results.
"""


# 3. Helper: Extract Artifacts from Tool Messages
def _extract_artifacts_from_tool_messages(messages: List[Any]) -> Dict[str, str]:
    """
    Parses ToolMessage outputs from SandboxExportQuerySQLTool and create_dashboard
    to populate the shared state 'artifacts' registry (name -> path).
    """
    new_artifacts = {}

    for msg in messages:
        if not isinstance(msg, ToolMessage):
            continue

        # Extract SQL exported CSVs
        if msg.name == "query_sql_database_tool":
            try:
                payload = json.loads(msg.content)
                if payload.get("status") == "success" and "file_path" in payload:
                    filename = payload.get("filename", "sql_output.csv")
                    new_artifacts[filename] = payload["file_path"]
            except (json.JSONDecodeError, TypeError):
                pass

        # Extract Dashboard JSON artifacts
        elif msg.name == "create_dashboard":
            artifact = getattr(msg, "artifact", None)
            if isinstance(artifact, dict) and "id" in artifact:
                new_artifacts[f"dashboard_{artifact['id']}"] = artifact.get("path", "")
            else:
                try:
                    payload = json.loads(msg.content)
                    if "artifact" in payload:
                        art = payload["artifact"]
                        new_artifacts[f"dashboard_{art['id']}"] = art["path"]
                except (json.JSONDecodeError, TypeError):
                    pass

    return new_artifacts


# 4. Instantiate Tools and Deep Agent
_backend_dir = Path(__file__).resolve().parents[2]
_financials_db = _backend_dir / "data" / "financials.db"
_financials_db.parent.mkdir(parents=True, exist_ok=True)
sql_toolset = create_sql_tools(db_path=str(_financials_db), sandbox_dir=str(_backend_dir / "sandbox_data"))

# Use the same backend interface as the Narrator. Subprocess is a deliberate
# local-development default; deployed environments select SANDBOX_BACKEND.
_sandbox_backend_name = os.getenv("SANDBOX_BACKEND", "subprocess")
_sandbox_backend_kwargs = (
    {"workspace": str(_backend_dir / "sandbox_data")}
    if _sandbox_backend_name == "subprocess"
    else {}
)
_sandbox_backend = SandboxBackendFactory.create(
    _sandbox_backend_name, **_sandbox_backend_kwargs
).start()
sandbox_toolset = [create_run_python_sandbox_tool(_sandbox_backend)]

all_analyst_tools = [
    *sql_toolset,
    *sandbox_toolset,
    dashboard_tool,
]

llm = ChatAnthropic(model="claude-3-7-sonnet-20250219")

data_analyst_agent = create_deep_agent(
    model=llm,
    tools=all_analyst_tools,
    system_prompt=DATA_ANALYST_PROMPT,
)


# 5. LangGraph Node Function
def data_analyst_node(state: GraphState) -> Command:
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

    # Construct context task message
    task_prompt = (
        f"Active Task: {task_desc}\n"
        f"Available Host/Sandbox Artifacts: {json.dumps(existing_artifacts, indent=2)}"
    )

    # Run agent execution
    result = data_analyst_agent.invoke({"messages": [HumanMessage(content=task_prompt)]})

    # Extract new artifacts and update dictionary
    discovered_artifacts = _extract_artifacts_from_tool_messages(result["messages"])
    updated_artifacts = {**existing_artifacts, **discovered_artifacts}

    return Command(
        goto="Master Coordinator",
        update={
            "messages": [result["messages"][-1]],
            "artifacts": updated_artifacts,
        },
    )
