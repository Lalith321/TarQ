from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.context_manager import ContextManager
from app.models.schemas import ContextSnapshot

router = APIRouter(prefix="/context", tags=["context"])

# One shared session for this demo build — a real deployment keys this by
# session/conversation id (still no auth/user concept needed for that; a
# session id is not a login).
_sessions: dict[str, ContextManager] = {}


def _get_session(session_id: str) -> ContextManager:
    if session_id not in _sessions:
        _sessions[session_id] = ContextManager()
    return _sessions[session_id]


class TurnIn(BaseModel):
    session_id: str
    role: str
    content: str


class ArtifactIn(BaseModel):
    session_id: str
    kind: str
    payload: dict


@router.post("/turn")
def add_turn(body: TurnIn):
    ctx = _get_session(body.session_id)
    turn = ctx.add_turn(body.role, body.content)
    return {"tokens": turn.tokens, "total_tokens": ctx._total_tokens(),
            "memory_blocks": len(ctx.memory_blocks)}


@router.post("/artifact")
def add_artifact(body: ArtifactIn):
    ctx = _get_session(body.session_id)
    aid = ctx.add_artifact(body.kind, body.payload)
    return {"artifact_id": aid, "reference_line": ctx.artifacts[aid].reference_line()}


@router.get("/build", response_model=ContextSnapshot)
def build_context(session_id: str, query: str):
    if session_id not in _sessions:
        raise HTTPException(404, f"no session '{session_id}'")
    return _sessions[session_id].build_context(query)
