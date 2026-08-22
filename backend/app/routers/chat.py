import json
from contextlib import asynccontextmanager
from pathlib import Path
import tempfile

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from langchain_core.messages import HumanMessage, ToolMessage
from pydantic import BaseModel

from ..core.tarq_coord import DB_URI, build_compiled_graph, pool, AsyncPostgresSaver
from ..agent.narrator import create_narrator_tools


# FastAPI Lifespan to manage DB Connection Pool
@asynccontextmanager
async def router_lifespan():
    await pool.open()
    checkpointer = AsyncPostgresSaver(pool)
    await checkpointer.setup()
    yield
    await pool.close()


router = APIRouter(prefix="/analyst", tags=["analyst"])


# ============================================================================
# WebSocket Real-Time Streaming Endpoint
# ============================================================================


@router.websocket("/sessions/{session_id}/ws")
async def websocket_agent_stream(websocket: WebSocket, session_id: str):
    """Real-time streaming WebSocket endpoint.

    Persists and recovers full session state from PostgreSQL using thread_id=session_id.
    """
    await websocket.accept()

    # Instantiate checkpointer bound to connection pool
    checkpointer = AsyncPostgresSaver(pool)
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
    """Fetch current state directly from PostgreSQL checkpointer."""
    checkpointer = AsyncPostgresSaver(pool)
    compiled_app = build_compiled_graph(checkpointer)

    config = {"configurable": {"thread_id": session_id}}
    state_snapshot = await compiled_app.aget_state(config)

    if not state_snapshot.values:
        raise HTTPException(
            status_code=404, detail=f"No state found for session '{session_id}'"
        )

    # Standardize output history
    messages = [
        {
            "role": m.type,
            "content": m.content,
            "name": getattr(m, "name", None),
        }
        for m in state_snapshot.values.get("messages", [])
    ]

    return {
        "session_id": session_id,
        "next_step": state_snapshot.next,
        "messages": messages,
        "artifacts": state_snapshot.values.get("artifacts", {}),
    }


@router.delete("/sessions/{session_id}")
async def delete_session_state(session_id: str):
    """Clears history checkpoints for a session."""
    checkpointer = AsyncPostgresSaver(pool)
    config = {"configurable": {"thread_id": session_id}}

    # Wipe checkpoints in Postgres
    await checkpointer.adelete_thread(session_id)
    return {"closed": True, "session_id": session_id}