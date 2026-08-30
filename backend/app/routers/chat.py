import json
import uuid

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from langchain_core.messages import HumanMessage, ToolMessage

from ..core.tarq_coord import build_compiled_graph, get_checkpointer

router = APIRouter(prefix="/analyst", tags=["analyst"])


# ============================================================================
# Session Creation
# ============================================================================


@router.post("/sessions")
async def create_session():
    """Create a new LangGraph session. Returns a thread_id used for all
    subsequent WebSocket and state calls."""
    session_id = uuid.uuid4().hex[:12]
    return {"session_id": session_id}


# ============================================================================
# WebSocket Real-Time Streaming Endpoint
# ============================================================================


@router.websocket("/sessions/{session_id}/ws")
async def websocket_agent_stream(websocket: WebSocket, session_id: str):
    """Real-time streaming WebSocket endpoint.

    Persists and recovers full session state from PostgreSQL using thread_id=session_id.
    """
    await websocket.accept()

    checkpointer = await get_checkpointer()
    compiled_app = build_compiled_graph(checkpointer)

    # Config key maps session_id to LangGraph thread_id
    config = {"configurable": {"thread_id": session_id}}

    try:
        while True:
            # 1. Wait for incoming user payload
            raw_data = await websocket.receive_text()
            data = json.loads(raw_data)
            user_message = data.get("message", "")

            if not user_message:
                continue

            # 2. Stream graph execution steps over WebSocket
            # `astream_events` v2 delivers token chunks, node updates, and tool calls
            async for event in compiled_app.astream_events(
                {"messages": [HumanMessage(content=user_message)]},
                config=config,
                version="v2",
            ):
                event_type = event["event"]

                # A. Streaming LLM Token Chunks (Real-time generation)
                if event_type == "on_chat_model_stream":
                    chunk = event["data"]["chunk"].content
                    if chunk:
                        await websocket.send_json({
                            "type": "token",
                            "node": event.get("metadata", {}).get(
                                "langgraph_node", "agent"
                            ),
                            "content": chunk,
                        })

                # B. Node Transitions (Track active step in system)
                elif event_type == "on_chain_start":
                    node_name = event.get("metadata", {}).get("langgraph_node")
                    if node_name:
                        await websocket.send_json({
                            "type": "node_start",
                            "node": node_name,
                        })

                # C. Tool Execution Status Updates
                elif event_type == "on_tool_start":
                    await websocket.send_json({
                        "type": "tool_start",
                        "tool": event["name"],
                        "input": event["data"].get("input"),
                    })

                elif event_type == "on_tool_end":
                    await websocket.send_json({
                        "type": "tool_end",
                        "tool": event["name"],
                        "output": str(event["data"].get("output")),
                    })

            # Signal turn completion to client
            await websocket.send_json({"type": "done"})

    except WebSocketDisconnect:
        print(f"WebSocket client disconnected: {session_id}")
    except Exception as e:
        await websocket.send_json({"type": "error", "error": str(e)})
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