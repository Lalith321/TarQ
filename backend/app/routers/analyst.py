from __future__ import annotations

import shutil
import tempfile
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile
from pydantic import BaseModel

try:
    from app.agent.coordinator import DeepDataAnalystAgent
except ModuleNotFoundError:  # pragma: no cover - fallback for repo-root imports
    from backend.app.agent.coordinator import DeepDataAnalystAgent

router = APIRouter(prefix="/analyst", tags=["analyst"])

_UPLOAD_DIR = Path(tempfile.gettempdir()) / "dashboard_platform_analyst_uploads"
_UPLOAD_DIR.mkdir(exist_ok=True)

# In-memory session store — one Sandbox worker process per session. No auth
# concept, matching the rest of this build; sessions are just opaque ids.
_sessions: dict[str, DeepDataAnalystAgent] = {}


def _get_session(session_id: str) -> DeepDataAnalystAgent:
    agent = _sessions.get(session_id)
    if agent is None:
        raise HTTPException(404, f"no analyst session '{session_id}'")
    return agent


@router.post("/sessions")
def create_session():
    session_id = uuid.uuid4().hex[:12]
    # No llm_call_fn wired here — plug a real one in for production use;
    # without it the agent only responds to the deterministic `hints` path.
    _sessions[session_id] = DeepDataAnalystAgent()
    return {"session_id": session_id}


@router.post("/sessions/{session_id}/upload")
async def upload_dataset(session_id: str, file: UploadFile):
    _get_session(session_id)  # 404s if unknown
    dest = _UPLOAD_DIR / f"{session_id}_{file.filename}"
    with dest.open("wb") as out:
        shutil.copyfileobj(file.file, out)
    return {"path": str(dest)}


class MessageIn(BaseModel):
    message: str
    hints: dict | None = None  # deterministic-router-only; ignored once a real llm_call_fn is wired


@router.post("/sessions/{session_id}/message")
def send_message(session_id: str, body: MessageIn):
    agent = _get_session(session_id)
    return agent.step(body.message, hints=body.hints)


@router.get("/sessions/{session_id}/state")
def get_state(session_id: str):
    agent = _get_session(session_id)
    return {
        "rendered": agent.state.render(),
        "files": list(agent.state.files.keys()),
        "dataframes": {n: {"shape": d.shape, "columns": d.columns} for n, d in agent.state.dataframes.items()},
        "todos": [{"text": t.text, "status": t.status} for t in agent.state.todos],
        "context_turns": len(agent.ctx.turns),
        "context_memory_blocks": len(agent.ctx.memory_blocks),
        "artifacts": list(agent.ctx.artifacts.keys()),
    }


@router.delete("/sessions/{session_id}")
def close_session(session_id: str):
    agent = _sessions.pop(session_id, None)
    if agent:
        agent.shutdown()
    return {"closed": True}
