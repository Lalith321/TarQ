# Agentic Dashboard Platform — Build Plan

No login/auth/API keys in this pass, per instruction. Everything below is built
so auth can be slotted in later (a `get_current_user` FastAPI dependency and a
JWT/session check in the frontend fetch wrapper) without restructuring anything.

## 1. What changes and why

The original `PlatformDashboard.tsx` was a single ~750-line component: fetch
logic, chart config, KPI cards, quick actions, a hand-rolled tab bar, and a
drill-down modal with a hardcoded `switch` on `drillDown.type` all lived in one
file. The `dashboard_tool` was chart-only (bar/line/pie/area/table/stat) with
no geospatial widget and no way for a widget to declare "click me to go
deeper." Neither piece had any notion of *how the LLM agent that populates
these dashboards manages context* — every tool call implicitly assumed the
model's whole conversation fits in the window, and every document ingested
was assumed to already be tabular/structured.

This rework addresses four things directly:

1. **Componentized frontend** — dashboard is now data-driven (a `DashboardSpec`
   JSON contract), not hand-coded per widget.
2. **GIS widget + generalized drill-down** — added to `dashboard_tool` and to
   the frontend as first-class concerns, not bolted onto the chart types. GIS
   is opt-in per dashboard, not a default fixture (see the two seeded demos
   in `main.py`).
3. **Agentic context management with compression** — a `ContextManager` that
   keeps a token budget, summarizes overflow into memory blocks, and separates
   "conversation" from "artifacts" (tool outputs, insight bundles) so
   structured data never gets lossy-summarized away.
4. **Insight extraction from non-structured documents** — a chunk → extract →
   reduce pipeline that makes no assumption about input structure (works on a
   messy .txt dump the same way it works on a clean .csv).

## 2. Architecture

```
                 ┌─────────────────────────┐
                 │        Frontend          │
                 │  React + TS components   │
                 │  (data-driven widgets)    │
                 └────────────┬─────────────┘
                              │ REST (JSON)
                 ┌────────────▼─────────────┐
                 │        FastAPI            │
                 │  routers: dashboard,      │
                 │  documents, context, ml,  │
                 │  analyst                  │
                 └────────────┬─────────────┘
   ┌──────────────────┬───────┼───────┬──────────────────┐
   ▼                  ▼       ▼       ▼                  ▼
┌─────────┐  ┌────────────┐ ┌────┐ ┌────────────┐ ┌──────────────┐
│dashboard │  │insight_    │ │ctx │ │app/agent/  │ │app/ml/        │
│_service  │  │extractor   │ │mgr │ │(sandbox,   │ │(Optuna trainer,│
│(drilldown│  │(format-    │ │    │ │ state,     │ │ registry,      │
│resolution│  │ agnostic)  │ │    │ │ deep agent)│ │ explain)        │
└─────────┘  └────────────┘ └────┘ └────────────┘ └──────────────┘
```

Backend stays consistent with the existing stack (FastAPI, SQLAlchemy over
SQLite for now with Postgres as a one-line swap, LangChain/LangGraph-shaped
pluggable LLM calls) rather than introducing a new framework.

## 3. Original build order (frontend/backend rework)

1. Shared schemas (`models/schemas.py`) — `WidgetSpec` gets a `gis` type and a
   `drill_down` block; this is the contract both tool and frontend read.
2. `context_manager.py` — compression + artifact vault, framework-agnostic
   (pluggable `summarize_fn`, works with a stub in tests, a real model in prod).
3. `insight_extractor.py` — format-agnostic ingestion pipeline.
4. `dashboard_service.py` + routers — wire the above behind REST endpoints.
5. Frontend: types → services → widgets → `DrillDownModal` → slim
   `PlatformDashboard.tsx` → document insight components.
6. Enhanced `dashboard_tool.py` (GIS + drill-down + docstring updates).

## 4. Deep agent data analyst + ML training system (added after the initial build)

Two more subsystems, deliberately separate packages (`app/agent/`, `app/ml/`)
rather than folded into the dashboard code, but wired into the same backend
and reusable as standalone LangChain tools (`tools/run_python_sandbox_tool.py`,
`tools/train_ml_model_tool.py`) for any other agent in the codebase.

**`app/agent/` — DeepDataAnalystAgent**
- `sandbox.py`: a long-lived worker process per session so variables persist
  across calls (load a dataframe once, reference it later) — isolation is a
  denylist + CPU rlimit, not a container.
- `state.py`: `AgentState` — virtual filesystem, dataframe descriptors, plan,
  execution log — re-rendered into the prompt fresh every turn. This is the
  "state injection": the model is never trusted to remember what exists from
  scrollback alone.
- `deep_agent.py`: ties `Sandbox` + `AgentState` + the existing
  `ContextManager` (reused unchanged from section 2/3) together with a small
  tool set (`run_python`, `load_csv`, `train_ml_model`, `write_file`,
  `read_file`, `set_plan`). Large structured tool results (an ML training
  report) go into `ContextManager`'s artifact vault, not into compressed
  conversation — this is where "advanced context management" actually pays
  off, not just in the summarization mechanism itself.

**`app/ml/` — Optuna-driven trainer**
- Deterministic, LLM-free by default: `problem_type.py` (dtype/cardinality
  heuristic), `preprocessing.py` (sklearn `ColumnTransformer` from column
  dtypes), `search_space.py` + `trainer.py` (Optuna study per candidate model
  family, cross-validated, zero LLM calls in the loop).
- `explain.py` is the *only* place an LLM is allowed near this system: an
  optional, single, post-hoc call to turn an already-computed report into
  prose. It never influences model/hyperparameter selection.
- `registry.py` persists trained pipelines (joblib) and serves predictions.

## 5. What's tested, not just written

Every module above was exercised via direct calls and `TestClient` during
this build, not left as an untested sketch: sandbox statefulness/denylist/
timeout-recovery, context compression triggering at a token budget, both
insight-extraction paths (heuristic and injected-LLM), the full deep-agent
loop (load CSV → train model → artifact vault, verified the ML report never
enters conversational turns), and OptunaTrainer on synthetic classification
and regression data including the registry save/predict round trip.

See `LIMITATIONS.md` for what's genuinely stubbed (sandbox isolation
strength, no xgboost/lightgbm candidates, in-memory session/model stores,
no real LLM wired in anywhere by default).
