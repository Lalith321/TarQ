import pandas as pd
from langgraph.graph import StateGraph, END, MessagesState
from langgraph.prebuilt import ToolNode
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import AIMessage
from langgraph.types import Command
from langchain.agents import create_agent
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from psycopg_pool import AsyncConnectionPool

from ..agent.data_analyst import data_analyst_node
from ..agent.narrator import NARRATOR_PROMPT, narrator
from ..agent.state import GraphState, TodoUpdate
from ..routers.agent_configs import get_agent_config
from ..llm_config import create_chat_model
from langchain_core.runnables import RunnableConfig

COORDINATOR_PROMPT = """You are the Master Coordinator for a data analysis and \
presentation pipeline made up of two other agents: Data Analyst and Narrator.

Your job every turn:
## Responsibility
Own the shared task plan and route work between the Data Analyst and Narrator.
Do not query data, perform analysis, create widgets, write presentation code,
or claim that work is complete on an agent's behalf.

## Planning and routing
1. Read the user's request, conversation, existing todo, latest worker report,
    available artifacts, and enabled-worker list on every turn.
2. Preserve existing task IDs and completed work. Add, revise, or remove tasks
    only when the user's request or new evidence requires it. Split work into
    concrete, ordered tasks and assign each to exactly one enabled worker.
3. Assign data discovery, SQL, computation, interpretation, and dashboard or
    widget creation to Data Analyst. Assign turning available, verified
    artifacts into a rendered Remotion video to Narrator. Narrator does not
    produce PPT decks. Do not assign work outside these capabilities.
    When selected SQL sources are attached, treat their listed tables as
    available for investigation. Route data-dependent requests to Data Analyst
    to inspect and query those sources before reporting that data is missing or
    inaccessible. Do not substitute lack of public-web access for checking an
    attached source.
4. Make each task description executable: state the requested deliverable,
    relevant measures and their definitions, filters, date ranges, grouping,
    comparison baseline, and expected handoff when known. Preserve the user's
    exact constraints and distinguish them from any assumptions.
5. Do not silently decide material ambiguities or invent business definitions.
    Make only a low-risk, clearly stated assumption when the conversation or
    available data strongly supports it. Otherwise leave the task blocked and
    use `note` to state the specific clarification needed from the user.
6. Keep at most one task `in_progress`; all other unfinished tasks are
    `pending`. Mark a task `completed` only when the assigned agent's latest
    report provides evidence that its deliverable was produced. Mark a task
    `blocked` only for a real dependency, missing data/access, disabled worker,
    unsupported capability, or unresolved material ambiguity, and state why.
7. Set `next` to the enabled owner of the sole `in_progress` task. Set `next`
    to `end` only when all work is completed, or no remaining work can proceed
    and the blockers/needed user input are clearly stated in `note`.

## Output discipline
Return a coherent full todo, not a new plan that forgets prior progress. Keep
`note` concise and factual: summarize the routing decision, completed evidence,
or the exact blocker/question. Never treat a request to do work as evidence
that the work was done.
"""


def master_coordinator(state: GraphState, config: RunnableConfig) -> Command:
    """Coordinator node: updates the shared todo list, judges what's actually
    done, and routes to whichever agent owns the next in-progress task."""
    configurable = config.get("configurable", {})
    fleet_id = configurable.get("fleet_id")
    configs = {
        "Data Analyst": get_agent_config("analyst", fleet_id),
        "Narrator": get_agent_config("narrator", fleet_id),
    }
    enabled_workers = [name for name, config in configs.items() if config.enabled]
    coordinator_config = get_agent_config("coordinator", fleet_id)
    coordinator_llm = create_agent(
        model=create_chat_model(configurable.get("model_settings")),
        system_prompt=COORDINATOR_PROMPT,
        response_format=TodoUpdate,
    )
    result = coordinator_llm.invoke(
        {"messages": [*state["messages"],
         ("system", f"Current todo: {state.get('todo', [])}\n"
                     f"Selected SQL sources: {state.get('selected_sources', [])}\n"
                     f"Enabled worker agents: {enabled_workers}. Do not assign tasks to disabled agents.\n"
                     f"Coordinator instructions: {coordinator_config.instructions}")
        ]}
    )
    last_msg = result["messages"][-1]
    content = last_msg.content
    decision = TodoUpdate(**content) if isinstance(content, dict) else TodoUpdate.model_validate_json(content)

    todo = decision.todo
    note = decision.note
    if decision.next == "end":
        goto = END
    elif not configs[decision.next].enabled:
        todo = [
            {**task, "status": "blocked"}
            if task["assigned_to"] == decision.next and task["status"] == "in_progress"
            else task
            for task in decision.todo
        ]
        note = f"{note}\nTask blocked: {decision.next} is disabled in Agent Fleet settings."
        goto = END
    else:
        goto = decision.next
    return Command(
        goto=goto,
        update={
            "todo": todo,
            "messages": [AIMessage(content=note)],
        },
    )


import asyncio
import os

# PostgreSQL Connection String
DB_URI = os.getenv(
    "DATABASE_URL", "postgresql://admin:Tarq321@localhost:5432/tarq_core"
).replace("postgresql+psycopg://", "postgresql://", 1)

# 1. Connection pool initialization
pool = AsyncConnectionPool(
    conninfo=DB_URI,
    max_size=20,
    kwargs={"autocommit": True},
    open=False,
)
_pool_ready = False
_pool_lock = asyncio.Lock()

async def get_checkpointer() -> AsyncPostgresSaver:
    """Initializes and returns the PostgreSQL checkpointer."""
    global _pool_ready
    async with _pool_lock:
        if not _pool_ready:
            await pool.open(wait=True)
            checkpointer = AsyncPostgresSaver(pool)
            await checkpointer.setup()
            _pool_ready = True
        return AsyncPostgresSaver(pool)


async def close_checkpointer_pool() -> None:
    """Closes the shared PostgreSQL pool during application shutdown."""
    global _pool_ready
    async with _pool_lock:
        if _pool_ready:
            await pool.close()
            _pool_ready = False


# 2. Build and Compile Graph
def build_compiled_graph(checkpointer: AsyncPostgresSaver):
    graph = StateGraph(GraphState)
    graph.add_node("Data Analyst", data_analyst_node)
    graph.add_node("Narrator", narrator)
    graph.add_node("Master Coordinator", master_coordinator)
    graph.set_entry_point("Master Coordinator")


    return graph.compile(checkpointer=checkpointer)