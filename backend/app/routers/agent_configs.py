from __future__ import annotations

import uuid

from fastapi import APIRouter
from fastapi import HTTPException
from pydantic import BaseModel
from app.db.database import SessionLocal
from app.models.db import AgentFleetStateModel

router = APIRouter(prefix="/api/agents", tags=["agent-configs"])


class AgentConfig(BaseModel):
    enabled: bool = True
    instructions: str = ""
    voice: str | None = None
    style: str | None = None
    creativity: int | None = None


class AgentFleet(BaseModel):
    id: str
    name: str
    configs: dict[str, AgentConfig]


class AgentFleetCreate(BaseModel):
    name: str
    configs: dict[str, AgentConfig] | None = None


class AgentFleetUpdate(BaseModel):
    name: str | None = None
    configs: dict[str, AgentConfig] | None = None


_DEFAULTS: dict[str, AgentConfig] = {
    "coordinator": AgentConfig(
        enabled=True,
        instructions=(
            "Break requests into clear, ordered tasks and delegate each to the right agent. "
            "Preserve the user's constraints, flag important ambiguity, and report blockers instead of guessing."
        ),
    ),
    "analyst": AgentConfig(
        enabled=True,
        instructions=(
            "Use only the selected data sources. Compute every reported figure from data, "
            "preserve filters and time ranges, and explain important assumptions or limitations. "
            "Never invent results."
        ),
    ),
    "narrator": AgentConfig(
        enabled=True,
        instructions=(
            "Create a concise Remotion video from verified analysis artifacts. Preserve values, "
            "labels, units, and caveats; use purposeful data-driven scenes and motion, then "
            "report the rendered artifact and any blockers."
        ),
        voice="professional",
        style="documentary",
        creativity=50,
    ),
}

_configs: dict[str, AgentConfig] = {k: v.model_copy() for k, v in _DEFAULTS.items()}
_active_fleet_id = "default"
_fleets: dict[str, AgentFleet] = {
    _active_fleet_id: AgentFleet(
        id=_active_fleet_id,
        name="TarQ Agent Fleet",
        configs={k: v.model_copy() for k, v in _configs.items()},
    )
}
_state_loaded = False


def _load_state() -> None:
    global _active_fleet_id, _configs, _fleets, _state_loaded
    if _state_loaded:
        return
    with SessionLocal() as session:
        record = session.get(AgentFleetStateModel, "active")
    if record is not None:
        state = record.state
        loaded_fleets = {
            fleet_id: AgentFleet.model_validate(fleet)
            for fleet_id, fleet in state.get("fleets", {}).items()
        }
        if loaded_fleets:
            _fleets = loaded_fleets
            _active_fleet_id = state.get("active_fleet_id", "default")
            if _active_fleet_id not in _fleets:
                _active_fleet_id = next(iter(_fleets))
            _configs = _copy_configs(_fleets[_active_fleet_id].configs)
    _state_loaded = True


def _persist_state() -> None:
    state = {
        "active_fleet_id": _active_fleet_id,
        "fleets": {fleet_id: fleet.model_dump(mode="json") for fleet_id, fleet in _fleets.items()},
    }
    with SessionLocal() as session:
        with session.begin():
            session.merge(AgentFleetStateModel(id="active", state=state))


def _copy_configs(configs: dict[str, AgentConfig]) -> dict[str, AgentConfig]:
    return {key: value.model_copy() for key, value in configs.items()}


@router.get("/fleets")
def get_fleets() -> dict[str, object]:
    _load_state()
    return {"fleets": list(_fleets.values()), "activeFleetId": _active_fleet_id}


@router.post("/fleets")
def create_fleet(body: AgentFleetCreate) -> dict[str, object]:
    _load_state()
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Fleet name cannot be empty")

    fleet_id = f"fleet_{uuid.uuid4().hex[:12]}"
    fleet = AgentFleet(
        id=fleet_id,
        name=name,
        configs=_copy_configs(body.configs if body.configs is not None else _configs),
    )
    _fleets[fleet_id] = fleet
    _persist_state()
    return {"fleet": fleet, "activeFleetId": _active_fleet_id}


@router.put("/fleets/{fleet_id}")
def update_fleet(fleet_id: str, body: AgentFleetUpdate) -> AgentFleet:
    global _configs
    _load_state()
    fleet = _fleets.get(fleet_id)
    if fleet is None:
        raise HTTPException(status_code=404, detail="Fleet not found")

    if body.name is not None:
        name = body.name.strip()
        if not name:
            raise HTTPException(status_code=422, detail="Fleet name cannot be empty")
        fleet.name = name
    if body.configs is not None:
        fleet.configs = _copy_configs(body.configs)
        if fleet_id == _active_fleet_id:
            _configs = _copy_configs(fleet.configs)
    _persist_state()
    return fleet


@router.delete("/fleets/{fleet_id}")
def delete_fleet(fleet_id: str) -> dict[str, object]:
    global _active_fleet_id, _configs
    _load_state()
    if fleet_id not in _fleets:
        raise HTTPException(status_code=404, detail="Fleet not found")
    if len(_fleets) == 1:
        raise HTTPException(status_code=409, detail="At least one fleet must remain")

    del _fleets[fleet_id]
    if fleet_id == _active_fleet_id:
        _active_fleet_id = next(iter(_fleets))
        _configs = _copy_configs(_fleets[_active_fleet_id].configs)
    _persist_state()
    return {"fleets": list(_fleets.values()), "activeFleetId": _active_fleet_id}


@router.post("/fleets/{fleet_id}/activate")
def activate_fleet(fleet_id: str) -> dict[str, object]:
    global _active_fleet_id, _configs
    _load_state()
    fleet = _fleets.get(fleet_id)
    if fleet is None:
        raise HTTPException(status_code=404, detail="Fleet not found")
    _active_fleet_id = fleet_id
    _configs = _copy_configs(fleet.configs)
    _persist_state()
    return {"fleet": fleet, "activeFleetId": _active_fleet_id}


@router.post("/fleets/{fleet_id}/reset")
def reset_fleet(fleet_id: str) -> AgentFleet:
    global _configs
    _load_state()
    fleet = _fleets.get(fleet_id)
    if fleet is None:
        raise HTTPException(status_code=404, detail="Fleet not found")
    fleet.configs = _copy_configs(_DEFAULTS)
    if fleet_id == _active_fleet_id:
        _configs = _copy_configs(fleet.configs)
    _persist_state()
    return fleet


def get_agent_config(agent_id: str, fleet_id: str | None = None) -> AgentConfig:
    _load_state()
    fleet = _fleets.get(fleet_id or _active_fleet_id)
    configs = fleet.configs if fleet else {}
    return configs.get(agent_id, AgentConfig(enabled=False, instructions=""))


def agent_fleet_exists(fleet_id: str) -> bool:
    _load_state()
    return fleet_id in _fleets


@router.get("/configs")
def get_configs() -> dict[str, AgentConfig]:
    _load_state()
    return _configs


@router.put("/configs")
def save_configs(body: dict[str, AgentConfig]) -> dict[str, AgentConfig]:
    _load_state()
    _configs.update(body)
    _fleets[_active_fleet_id].configs = _copy_configs(_configs)
    _persist_state()
    return _configs


@router.post("/configs/reset")
def reset_configs() -> dict[str, AgentConfig]:
    global _configs
    _load_state()
    _configs = {k: v.model_copy() for k, v in _DEFAULTS.items()}
    _fleets[_active_fleet_id].configs = _copy_configs(_configs)
    _persist_state()
    return _configs
