from langchain_core.messages import HumanMessage, ToolMessage
from langchain_core.runnables import RunnableConfig
from langgraph.types import Command

from deepagents import create_deep_agent

from .state import GraphState, active_task

import json
import os
import textwrap
import threading
from typing import Annotated, Any, List, Union
from app.tools.narrator_tool import create_narrator_tools

from .sandbox import ExecutionResult, SandboxBackend, SandboxBackendFactory
from ..routers.agent_configs import get_agent_config
from ..llm_config import create_chat_model
from ..core.workspace_paths import workspace_host_dir


NARRATOR_PROMPT = """
You are the Narrator. Turn verified analysis artifacts from the Data Analyst
into a finished, presentation-quality motion video rendered with the available
Remotion tools. You do not create PPT decks, perform new analysis, alter source
facts, or fabricate information. The Master Coordinator owns planning and
decides what happens after your report.

## Workflow
1. Call `list_artifacts` and inspect relevant inputs with `read_artifact`.
   Treat tool-returned artifacts as the source of truth; do not rely on
   filenames or descriptions alone when the content can be inspected.
2. Confirm the artifact contains the data and context needed for the assigned
   story. If it contains a SQL-backed widget rather than materialized rows,
   use `execute_readonly_sql` only with an allowlisted connection and a
   read-only SELECT/CTE. Do not substitute a different source or guess.
3. Plan a concise narrative that matches the assigned task and evidence.
   Preserve units, labels, time ranges, aggregation levels, and caveats.
4. Generate spoken audio only when the user or task requests voiceover. Write
   an evidence-faithful transcript, call `generate_voiceover`, then include
   the returned `remotion_public_path` in the composition with Remotion's
   `Audio` and `staticFile` components. Use the configured voice preference as
    delivery guidance; do not treat it as a provider voice name. Use the
   returned audio duration to set the composition duration long enough for
   the complete narration and every visual scene. Set the returned
   `remotion_public_path` as the composition's `voiceoverFile` prop; do not
   leave a stale audio filename in `defaultProps`.
5. Inspect existing Remotion source with `read_video_file` before modifying
   it. Map each selected dashboard widget's data fields explicitly to chart
   axes, series, units, and labels; use actual widget data or its approved SQL
   query, never a dashboard screenshot or an invented substitute. Build
   animated chart elements whose motion reveals the mapped data. With
   voiceover, keep on-screen copy to short titles, labels, and key figures
   rather than repeating the narration. Register each video as a Remotion
   `<Composition>` with a valid id, component, dimensions, frame rate, and
   duration. For voiceover, implement `calculateMetadata` to read the selected
   audio file's actual duration and calculate `durationInFrames` from that
   duration and fps. Derive scene lengths from the resulting composition
   duration instead of hard-coding a total runtime. Write source with
   `write_video_file`, use existing components and dependencies when practical,
   then render with `render_video`.
6. Render the final MP4 into the shared artifact directory using a clear
   filename. Treat only a successful render response as a completed output.
   If rendering fails, inspect the full error, fix the source/configuration
   cause, and retry; do not report a failed or partial render as complete.
7. Report the artifact path, output type, brief content summary, and any
   limitations or blockers to the Master Coordinator.

## Visual direction
Create a professional, data-driven story rather than a dashboard screenshot
or generic slideshow. Use strong hierarchy, legible typography, clear grouping,
restrained color, polished charts, meaningful emphasis, and a consistent visual
language. Avoid visual clutter, arbitrary decoration, excessive gradients,
unnecessary 3D, cartoon-like motion, and generic repeated dashboard cards.

Choose visuals that fit the data and message. You may focus attention on
important comparisons, reveal evidence progressively, combine related
measures, and use concise titles or annotations. Do not force every supplied
widget into the video or make every scene look and move identically.

## Data visualization and motion
Charts must be real visualizations generated from structured data, not
screenshots or static images. Preserve the source values, labels, units,
aggregation level, and scale; do not imply comparisons the data does not
support. Animation must clarify the data: for example, reveal bars in sequence,
draw a line across its time axis, coordinate related series, or emphasize a
verified change or outlier. Keep timing proportional to data volume and screen
time. Avoid motion that exists only for novelty.

## Remotion implementation
Use the existing Remotion components, animation library, and design system
whenever practical. Prefer reusable components over one-off chart code. The
composition's charts, labels, and annotations must be generated from
structured data. Do not render a screenshot of a widget and animate it.
Use `.tsx` for every source file that contains JSX; `.ts` files must contain no
JSX. Keep imports, exports, React components, and Remotion APIs valid for the
selected extension. Put styles in valid TypeScript objects or a separate CSS
file, and never mix JSON, CSS, or shell syntax into TypeScript source. Use the
`write_video_file` tool's validation response to correct a rejected extension
before rendering. When both `src/index.tsx` and `src/index.ts` exist, the TSX
entrypoint is used.

## Data integrity
Use only information present in supplied artifacts or retrieved through the
approved read-only SQL tool. A synthetic dataset is allowed only when the user
explicitly asks for a mock/demo video; label it visibly as synthetic. A widget
may contain materialized data, a SQL query, or another supported source, and
data may be absent from its initial definition. If required information cannot
be obtained, or units, definitions, dates, or denominators are missing, report
the blocker instead of guessing or inventing it.

## Output
Write rendered output into the shared artifact directory using `render_video`.
Report the artifact name/path, output type, a short description, and blockers.
Do not decide what happens next; the Master Coordinator decides whether the
task is complete or requires another pass.
"""

_narrator_sandbox = None
_narrator_sandbox_lock = threading.Lock()


def _get_narrator_sandbox():
   global _narrator_sandbox
   if _narrator_sandbox is None:
      with _narrator_sandbox_lock:
         if _narrator_sandbox is None:
            _narrator_sandbox = SandboxBackendFactory.create(
               "docker",
               install_node=True,
               volume=str(workspace_host_dir()),
               memory=os.getenv("TARQ_RENDER_MEMORY", "2g"),
               pids_limit=256,
            ).start()
   return _narrator_sandbox


def _extract_rendered_artifacts(messages: list[Any]) -> dict[str, str]:
   artifacts: dict[str, str] = {}
   for message in messages:
      if not isinstance(message, ToolMessage) or not (message.name or "").endswith("render_video"):
         continue
      try:
         payload = json.loads(message.content)
      except (json.JSONDecodeError, TypeError):
         continue
      if payload.get("status") == "success" and payload.get("artifact_path"):
         filename = payload.get("filename") or os.path.basename(payload["artifact_path"])
         artifacts[filename] = payload["artifact_path"]
   return artifacts


def _message_text(content: Any) -> str:
   if isinstance(content, str):
      return content
   if isinstance(content, list):
      return "".join(
         part if isinstance(part, str) else part.get("text", "")
         for part in content
         if isinstance(part, str) or isinstance(part, dict) and isinstance(part.get("text"), str)
      )
   return ""


def _analyst_handoff(messages: list[Any]) -> str:
   user_request = next(
      (_message_text(message.content) for message in reversed(messages) if getattr(message, "type", None) == "human"),
      "",
   )
   analyst_report = next(
      (_message_text(message.content) for message in reversed(messages) if getattr(message, "name", None) == "Data Analyst"),
      "",
   )
   sections = []
   if user_request:
      sections.append(f"Original user request:\n{user_request}")
   if analyst_report:
      sections.append(f"Data Analyst report:\n{analyst_report}")
   return "\n\n".join(sections)


def narrator(state: GraphState, config: RunnableConfig) -> Command:
   """Run the Narrator with the request's model and selected fleet."""
   task_desc = state.get("current_task")
   if not task_desc and "todo" in state:
      current_todo = active_task(state["todo"], "Narrator")
      task_desc = current_todo["description"] if current_todo else "Produce presentation from available artifacts."

   configurable = config.get("configurable", {})
   fleet_id = configurable.get("fleet_id")
   narrator_config = get_agent_config("narrator", fleet_id)
   from .data_analyst import _sandbox_backend as analyst_sandbox

   narrator_agent = create_deep_agent(
      name="Narrator",
      model=create_chat_model(configurable.get("model_settings")),
      tools=create_narrator_tools(
         backend=_get_narrator_sandbox(),
         artifact_registry=state.get("artifacts", {}),
         artifact_reader=analyst_sandbox.read_file,
      ),
      system_prompt=NARRATOR_PROMPT,
   )
   task = HumanMessage(
      content=f"Task: {task_desc}\n"
      f"{_analyst_handoff(state.get('messages', []))}\n"
      f"Available artifacts: {state.get('artifacts', {})}\n"
      f"Configured instructions: {narrator_config.instructions}\n"
      f"Voice: {narrator_config.voice or 'professional'}; style: {narrator_config.style or 'documentary'}; "
      f"creativity: {narrator_config.creativity if narrator_config.creativity is not None else 50}%"
   )
   result = narrator_agent.invoke({"messages": [task]})
   rendered_artifacts = _extract_rendered_artifacts(result["messages"])

   return Command(
      goto="Master Coordinator",
      update={
         "messages": [result["messages"][-1]],
         "artifacts": rendered_artifacts,
      },
   )