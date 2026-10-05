"""
coordinator.py — thin session wrapper used by routers/analyst.py.

DeepDataAnalystAgent is a per-session object that holds a simple in-memory
state and delegates execution to the data_analyst_node via a minimal
LangGraph-compatible invocation.  It intentionally avoids importing the
heavy LangGraph graph builder at module load time so the router can import
this file even when optional LLM credentials are absent.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Any


@dataclass
class _Todo:
    text: str
    status: str = "pending"


@dataclass
class _State:
    session_id: str
    messages: list[str] = field(default_factory=list)
    files: dict[str, str] = field(default_factory=dict)
    dataframes: dict[str, Any] = field(default_factory=dict)
    todos: list[_Todo] = field(default_factory=list)

    def render(self) -> str:
        if not self.messages:
            return "(no messages yet)"
        return self.messages[-1]


class DeepDataAnalystAgent:
    """
    Stateful per-session agent wrapper.

    The router creates one instance per session and calls .step() for each
    user message.  Heavy imports (LangChain, LangGraph, sandbox) are deferred
    to the first .step() call so the router module loads fast even when
    optional dependencies are missing.
    """

    def __init__(self, llm_call_fn=None):
        self._llm_call_fn = llm_call_fn
        self.state = _State(session_id=uuid.uuid4().hex[:12])
        self._graph = None  # lazy

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _ensure_graph(self):
        """Build the LangGraph graph on first use."""
        if self._graph is not None:
            return
        try:
            from app.agent.data_analyst import data_analyst_node
            from app.agent.narrator import narrator
            from app.agent.state import GraphState
            from langgraph.graph import StateGraph, END

            builder = StateGraph(GraphState)
            builder.add_node("Data Analyst", data_analyst_node)
            builder.add_node("Narrator", narrator)
            builder.set_entry_point("Data Analyst")
            builder.add_edge("Data Analyst", END)
            self._graph = builder.compile()
        except Exception as exc:  # pragma: no cover
            # If the graph can't be built (missing creds, missing deps) we
            # fall back to the deterministic hints path in step().
            self._graph = None
            self._graph_error = str(exc)

    # ------------------------------------------------------------------
    # Public API used by routers/analyst.py
    # ------------------------------------------------------------------

    def step(self, message: str, hints: dict | None = None) -> dict:
        """
        Process one user message.

        If `hints` are provided (csv_path, df_name, target, n_trials) the
        agent takes the deterministic ML-training path without needing a
        real LLM.  Otherwise it attempts to invoke the full LangGraph graph.
        """
        self.state.messages.append(f"user: {message}")

        # ── Deterministic path (hints provided) ──────────────────────
        if hints:
            reply = self._run_hints(message, hints)
            self.state.messages.append(f"assistant: {reply}")
            return {"reply": reply, "state": self._public_state()}

        # ── LangGraph path ────────────────────────────────────────────
        self._ensure_graph()
        if self._graph is not None:
            try:
                from langchain_core.messages import HumanMessage
                result = self._graph.invoke({
                    "messages": [HumanMessage(content=message)],
                    "artifacts": self.state.files,
                    "todo": [],
                    "current_task": message,
                    "selected_sources": [],
                })
                last = result["messages"][-1]
                reply = last.content if hasattr(last, "content") else str(last)
                # Merge any new artifacts back into session state
                self.state.files.update(result.get("artifacts", {}))
            except Exception as exc:
                reply = f"Agent error: {exc}"
        else:
            reply = (
                "Agent graph unavailable "
                f"({getattr(self, '_graph_error', 'unknown error')}). "
                "Provide `hints` for the deterministic path."
            )

        self.state.messages.append(f"assistant: {reply}")
        return {"reply": reply, "state": self._public_state()}

    def shutdown(self) -> None:
        """Release any held resources (sandbox workers, etc.)."""
        self._graph = None

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _run_hints(self, message: str, hints: dict) -> str:
        """Deterministic ML-training path driven by explicit hints dict."""
        csv_path = hints.get("csv_path")
        target   = hints.get("target")
        n_trials = int(hints.get("n_trials", 10))
        df_name  = hints.get("df_name", "df")

        if not csv_path or not target:
            return (
                "Hints path requires at least `csv_path` and `target`. "
                f"Received: {list(hints.keys())}"
            )

        try:
            import pandas as pd
            from app.ml.service import MlService

            df = pd.read_csv(csv_path)
            self.state.dataframes[df_name] = df

            svc = MlService()
            result = svc.train(df=df, target=target, n_trials=n_trials)
            self.state.files[f"model_{result.model_id}"] = result.model_id

            todo = _Todo(text=f"Train model on {csv_path} → {target}", status="completed")
            self.state.todos.append(todo)

            return (
                f"Training complete. Best model: {result.best_model_name} "
                f"({result.metric}={result.best_score:.4f}) "
                f"over {result.n_rows} rows × {result.n_features} features "
                f"in {result.duration_s:.1f}s. model_id={result.model_id}"
            )
        except Exception as exc:
            return f"Training failed: {exc}"

    def _public_state(self) -> dict:
        return {
            "session_id": self.state.session_id,
            "message_count": len(self.state.messages),
            "files": list(self.state.files.keys()),
            "todos": [{"text": t.text, "status": t.status} for t in self.state.todos],
        }
