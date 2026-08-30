from langchain_google_genai import ChatGoogleGenerativeAI
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

COORDINATOR_PROMPT = """You are the Master Coordinator for a data analysis and \
presentation pipeline made up of two other agents: Data Analyst and Narrator.

Your job every turn:
1. Look at the user's request and the conversation so far.
2. Maintain `todo` — the single shared plan both other agents read from. Break
   the request into concrete tasks, each assigned to exactly one agent
   (Data Analyst for querying/analysis/widgets, Narrator for turning finished
   artifacts into a video or PPT). Don't recreate the list from scratch each
   turn — carry forward existing tasks, only add, update status, or extend as
   the conversation actually requires.
3. Write a DETAILED description for every task, not a one-line label. State
   exactly what to compute, any filters/time windows/grouping the user gave,
   and define any domain-specific term you use (churn rate, MRR, HHI, cohort
   retention, whatever the domain calls for) so the executing agent isn't
   left guessing. If the request is ambiguous (e.g. "top" — top by what
   metric?), resolve it yourself and note the assumption in the task
   description — don't leave that ambiguity for the worker to resolve.
4. Keep AT MOST ONE task "in_progress" at a time — this pipeline runs one
   step at a time, not in parallel. Everything not yet started is "pending",
   everything the relevant agent has finished (based on their latest reply)
   is "completed", anything genuinely stuck is "blocked" — say why.
5. Decide `next`: the agent assigned to the task you just marked
   "in_progress", or "end" once every task is "completed" (or the remaining
   ones are "blocked" and you've explained why).
6. You never analyze data or produce artifacts yourself — you only plan,
   assign, and track. Judge whether a task is actually done from what the
   agent reported back, not from what was merely asked of them.
"""


# llm = ChatAnthropic(model="claude-sonnet-4-5")
llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash")
coordinator_llm = create_agent(
    model=llm,
    system_prompt=COORDINATOR_PROMPT,
    response_format=TodoUpdate,
)


def master_coordinator(state: GraphState) -> Command:
    """Coordinator node: updates the shared todo list, judges what's actually
    done, and routes to whichever agent owns the next in-progress task."""
    result = coordinator_llm.invoke(
        {"messages": [*state["messages"],
         ("system", f"Current todo: {state.get('todo', [])}")
        ]}
    )
    last_msg = result["messages"][-1]
    content = last_msg.content
    decision = TodoUpdate(**content) if isinstance(content, dict) else TodoUpdate.model_validate_json(content)

    goto = END if decision.next == "end" else decision.next
    return Command(
        goto=goto,
        update={
            "todo": decision.todo,
            "messages": [AIMessage(content=decision.note)],
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