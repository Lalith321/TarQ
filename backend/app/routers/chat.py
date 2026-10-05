import asyncio
import json
import uuid

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

from ..core.tarq_coord import build_compiled_graph, get_checkpointer
from ..models.schemas import SchemaSourceType, SchemaStatus
from ..services.dashboard_service import dashboard_service
from .agent_configs import agent_fleet_exists

router = APIRouter(prefix="/analyst", tags=["analyst"])

_DASHBOARD_TOOL = "dashboard_tool"


def _text_from_content(content: object) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(
            part if isinstance(part, str) else part.get("text", "")
            for part in content
            if isinstance(part, str) or isinstance(part, dict) and isinstance(part.get("text"), str)
        )
    return ""


def _resolve_selected_sources(raw_sources: object) -> list[dict]:
    if raw_sources is None:
        return []
    if not isinstance(raw_sources, list):
        raise ValueError("selected_sources must be a list")

    resolved: list[dict] = []
    seen_ids: set[str] = set()
    for item in raw_sources:
        if not isinstance(item, dict):
            raise ValueError("Each selected source must include a schema_id and tables")
        schema_id = item.get("schema_id")
        tables = item.get("tables")
        if not isinstance(schema_id, str) or not schema_id or not isinstance(tables, list):
            raise ValueError("Each selected source must include a schema_id and tables")
        if schema_id in seen_ids:
            raise ValueError(f"Duplicate selected schema '{schema_id}'")
        seen_ids.add(schema_id)

        schema = dashboard_service.get_schema(schema_id)
        if schema is None:
            raise ValueError(f"Selected schema '{schema_id}' was not found")
        if schema.source_type != SchemaSourceType.REMOTE_SQL:
            raise ValueError(f"Selected schema '{schema.name}' is not a SQL database")
        if schema.status not in {SchemaStatus.CONNECTED, SchemaStatus.READY}:
            raise ValueError(f"Selected schema '{schema.name}' is not connected")
        if dashboard_service.get_schema_password(schema_id) is None:
            raise ValueError(f"Credentials for '{schema.name}' are unavailable; reconnect and import it again")

        available_tables = {table.name for table in schema.tables}
        if any(not isinstance(table, str) or table not in available_tables for table in tables):
            raise ValueError(f"Selected tables for '{schema.name}' must come from that saved schema")
        resolved.append({"schema_id": schema_id, "tables": list(dict.fromkeys(tables))})

    return resolved


# ============================================================================
# Session Creation
# ============================================================================


@router.post("/sessions")
async def create_session():
    session_id = uuid.uuid4().hex[:12]
    return {"session_id": session_id}


# ============================================================================
# WebSocket Real-Time Streaming Endpoint
# ============================================================================


@router.websocket("/sessions/{session_id}/ws")
async def websocket_agent_stream(websocket: WebSocket, session_id: str):
    await websocket.accept()

    checkpointer = await get_checkpointer()
    compiled_app = build_compiled_graph(checkpointer)
    config = {"configurable": {"thread_id": session_id}}

    try:
        while True:
            raw_data = await websocket.receive_text()
            data = json.loads(raw_data)
            user_message = data.get("message", "")
            if not user_message:
                continue
            try:
                selected_sources = _resolve_selected_sources(data.get("selected_sources", []))
            except ValueError as exc:
                await websocket.send_json({"type": "error", "message": str(exc)})
                continue

            fleet_id = data.get("fleet_id")
            if fleet_id is not None and (not isinstance(fleet_id, str) or not agent_fleet_exists(fleet_id)):
                await websocket.send_json({"type": "error", "message": "Selected agent fleet was not found"})
                continue
            model_settings = data.get("model_settings")
            if not isinstance(model_settings, dict):
                await websocket.send_json({"type": "error", "message": "Model preferences are missing; save provider and model settings first"})
                continue
            if any(not isinstance(model_settings.get(key), str) for key in ("provider", "model", "api_key")):
                await websocket.send_json({"type": "error", "message": "Model preferences are invalid"})
                continue

            request_config = {
                "configurable": {
                    "thread_id": session_id,
                    "fleet_id": fleet_id,
                    "model_settings": model_settings,
                }
            }

            async def stream_graph() -> None:
                final_content = ""

                async for event in compiled_app.astream_events(
                    {
                        "messages": [HumanMessage(content=user_message)],
                        "selected_sources": selected_sources,
                    },
                    config=request_config,
                    version="v2",
                ):
                    etype = event["event"]

                    if etype == "on_chat_model_stream":
                        chunk = _text_from_content(event["data"]["chunk"].content)
                        if chunk:
                            final_content += chunk
                            await websocket.send_json({"type": "message_delta", "content": chunk})
                    elif etype == "on_tool_start":
                        await websocket.send_json({
                            "type": "tool_started",
                            "tool": event["name"],
                            "toolCallId": event.get("run_id", ""),
                        })
                    elif etype == "on_tool_end":
                        tool_name = event["name"]
                        run_id = event.get("run_id", "")

                        if tool_name == _DASHBOARD_TOOL:
                            output = event["data"].get("output")
                            artifact = getattr(output, "artifact", None)
                            if artifact is None and isinstance(output, tuple):
                                artifact = output[1]
                            if isinstance(artifact, dict):
                                for widget in artifact.get("widgets", []):
                                    widget_id = widget.get("id") or uuid.uuid4().hex[:8]
                                    await websocket.send_json({
                                        "type": "widget_created",
                                        "widgetId": widget_id,
                                        "widget": widget,
                                    })
                        else:
                            await websocket.send_json({"type": "tool_finished", "toolCallId": run_id})

                await websocket.send_json({"type": "final", "content": final_content})

            graph_task = asyncio.create_task(stream_graph())
            try:
                while not graph_task.done():
                    receive_task = asyncio.create_task(websocket.receive_text())
                    done, _ = await asyncio.wait(
                        {graph_task, receive_task},
                        return_when=asyncio.FIRST_COMPLETED,
                    )
                    if graph_task in done:
                        receive_task.cancel()
                        await asyncio.gather(receive_task, return_exceptions=True)
                        await graph_task
                        break

                    control = json.loads(receive_task.result())
                    if control.get("type") == "interrupt":
                        graph_task.cancel()
                        await asyncio.gather(graph_task, return_exceptions=True)
                        await websocket.send_json({"type": "interrupted"})
                        break
                    await websocket.send_json({"type": "error", "message": "A chat run is already in progress"})
            except WebSocketDisconnect:
                graph_task.cancel()
                await asyncio.gather(graph_task, return_exceptions=True)
                raise
            finally:
                if not graph_task.done():
                    graph_task.cancel()
                    await asyncio.gather(graph_task, return_exceptions=True)

    except WebSocketDisconnect:
        pass
    except Exception as e:
        await websocket.send_json({"type": "error", "message": str(e)})
        await websocket.close()


# ============================================================================
# Session State Querying & REST Endpoints
# ============================================================================


@router.get("/sessions/{session_id}/state")
async def get_session_state(session_id: str):
    """Fetch current state from PostgreSQL checkpointer.
    Also extracts any dashboard/widget artifacts emitted by dashboard_tool
    so the frontend can render them directly."""
    checkpointer = await get_checkpointer()
    compiled_app = build_compiled_graph(checkpointer)

    config = {"configurable": {"thread_id": session_id}}
    state_snapshot = await compiled_app.aget_state(config)

    if not state_snapshot.values:
        raise HTTPException(
            status_code=404, detail=f"No state found for session '{session_id}'"
        )

    raw_messages = state_snapshot.values.get("messages", [])

    messages = [
        {
            "role": m.type,
            "content": m.content if isinstance(m.content, str) else "",
            "name": getattr(m, "name", None),
        }
        for m in raw_messages
    ]

    # Extract dashboard_tool artifacts from ToolMessages so the UI can render widgets
    widgets: list[dict] = []
    for m in raw_messages:
        if isinstance(m, ToolMessage) and m.name == "dashboard_tool":
            artifact = getattr(m, "artifact", None)
            if isinstance(artifact, dict):
                widgets = artifact.get("widgets", [])

    return {
        "session_id": session_id,
        "next_step": state_snapshot.next,
        "messages": messages,
        "artifacts": state_snapshot.values.get("artifacts", {}),
        "widgets": widgets,
        "todo": state_snapshot.values.get("todo", []),
    }


@router.delete("/sessions/{session_id}")
async def delete_session_state(session_id: str):
    """Clears history checkpoints for a session."""
    checkpointer = await get_checkpointer()
    config = {"configurable": {"thread_id": session_id}}

    # Wipe checkpoints in Postgres
    await checkpointer.adelete_thread(session_id)
    return {"closed": True, "session_id": session_id}