"""Single chat entry point for text, standalone widgets, and dashboards."""

from __future__ import annotations

import uuid
from typing import Any, Literal

from fastapi import APIRouter, HTTPException
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from pydantic import BaseModel, Field

from app.models.schemas import WidgetSpec

router = APIRouter(prefix="/agent", tags=["agent"])


class DashboardChatRequest(BaseModel):
    sessionId: str
    message: str = Field(min_length=1)
    context: dict[str, Any] | None = None


class DashboardChatResponse(BaseModel):
    kind: Literal["text", "widget", "dashboard"]
    reply: str = ""
    widget: dict[str, Any] | None = None
    widgets: list[dict[str, Any]] = Field(default_factory=list)


def _normalise_widget(widget: dict[str, Any], index: int) -> dict[str, Any]:
    """Apply frontend-required defaults before validating an LLM tool payload."""
    normalised = dict(widget)
    normalised.setdefault("id", f"widget_{uuid.uuid4().hex[:12]}")
    normalised.setdefault("position", {"x": (index % 2) * 6, "y": (index // 2) * 4, "w": 6, "h": 4})
    return WidgetSpec.model_validate(normalised).model_dump(mode="json")


def _dashboard_artifact(messages: list[Any]) -> dict[str, Any] | None:
    for message in reversed(messages):
        if isinstance(message, ToolMessage) and message.name == "dashboard_tool":
            artifact = getattr(message, "artifact", None)
            if isinstance(artifact, dict):
                return artifact
    return None


def _reply_text(messages: list[Any]) -> str:
    for message in reversed(messages):
        if isinstance(message, AIMessage) and isinstance(message.content, str):
            return message.content
    return ""


@router.post("/dashboard-chat", response_model=DashboardChatResponse)
def dashboard_chat(payload: DashboardChatRequest) -> DashboardChatResponse:
    """Run the analyst and classify its output for the dashboard chat UI."""
    try:
        # Keep this lazy: importing the agent provisions the selected sandbox.
        from app.agent.data_analyst import data_analyst_agent

        result = data_analyst_agent.invoke({"messages": [HumanMessage(content=payload.message)]})
        messages = result.get("messages", [])
        artifact = _dashboard_artifact(messages)
        reply = _reply_text(messages)
    except Exception as exc:
        raise HTTPException(502, f"Agent execution failed: {exc}") from exc

    if not artifact:
        return DashboardChatResponse(kind="text", reply=reply)

    try:
        widgets = [_normalise_widget(widget, index) for index, widget in enumerate(artifact.get("widgets", []))]
    except Exception as exc:
        raise HTTPException(502, f"Agent returned an invalid widget payload: {exc}") from exc

    if len(widgets) == 1:
        return DashboardChatResponse(kind="widget", reply=reply, widget=widgets[0])
    if widgets:
        return DashboardChatResponse(kind="dashboard", reply=reply, widgets=widgets)
    return DashboardChatResponse(kind="text", reply=reply)
