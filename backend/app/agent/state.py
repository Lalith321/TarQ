"""
Shared LangGraph state for the multi-agent pipeline.

GraphState is the single source of truth passed between the Master Coordinator,
Data Analyst, and Narrator nodes.
"""
from __future__ import annotations

from typing import Annotated, List, Literal, Optional
from typing_extensions import TypedDict
from pydantic import BaseModel

from langgraph.graph import MessagesState


class Task(TypedDict):
    id: str
    description: str
    assigned_to: Literal["Data Analyst", "Narrator"]
    status: Literal["pending", "in_progress", "completed", "blocked"]


def _merge_dicts(left: dict, right: dict) -> dict:
    return {**left, **right}


class GraphState(MessagesState):
    # Shared artifact registry: name -> path, merged (not overwritten) on every update
    artifacts: Annotated[dict[str, str], _merge_dicts]
    # Full task plan owned by the Coordinator, readable by every agent
    todo: list[Task]
    # The specific instruction the Coordinator passes to the active agent this turn
    current_task: str


class TodoUpdate(BaseModel):
    """Structured output the Coordinator emits each turn."""
    todo: List[Task]
    next: Literal["Data Analyst", "Narrator", "end"]
    note: str  # brief coordinator note surfaced as an AIMessage


def active_task(todo: list[Task], agent: str) -> Optional[Task]:
    """Return the in_progress task assigned to `agent`, if any."""
    for task in todo:
        if task["assigned_to"] == agent and task["status"] == "in_progress":
            return task
    return None
