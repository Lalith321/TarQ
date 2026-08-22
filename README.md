# Agentic Dashboard Platform

Read `PLAN.md` for the design, `LIMITATIONS.md` for what's stubbed vs real.

## Layout

```
backend/    FastAPI service — context management, insight extraction, dashboard API
frontend/   React/TS components — meant to drop into the existing app
tools/      dashboard_tool.py — the LangChain tool an agent calls to populate a dashboard
```

The frontend is **not** a standalone app — it's a component set that assumes
the same host app as the original `PlatformDashboard.tsx` (same `@/components/ui/*`
shadcn primitives, `@/lib/apiEndpoints`, `@/hooks/use-toast`, `@/components/PageHeader`,
`wouter` router). Copy `frontend/src/*` into the existing project's `src/`.

## Backend

```bash
cd backend
pip install -r requirements.txt --break-system-packages   # or use a venv
uvicorn app.main:app --reload --port 8000
```

Verify it's up: `curl http://localhost:8000/health` → `{"status": "ok"}`

Two dashboards are seeded on boot, on purpose:
- `curl http://localhost:8000/dashboards/demo` — the default case: bar + stat
  + table, **no GIS widget**. Most dashboards look like this.
- `curl http://localhost:8000/dashboards/demo-gis` — the opt-in case: a
  domain that actually has a location dimension. GIS is one widget type
  among seven, not something every dashboard gets by default — see
  `_seed_demo_dashboard` vs `_seed_demo_gis_dashboard` in `main.py`.

No `.env` is required to run — `DATABASE_URL` defaults to a local SQLite
file, and no external API keys are used anywhere in this build.

To make extraction/summarization actually smart (rather than the heuristic
fallbacks described in LIMITATIONS.md), inject callables where the routers
construct these objects:

```python
# routers/documents.py
_extractor = DocumentInsightExtractor(extract_fn=my_llm_extract_call)

# core/context_manager.py usage site
ContextManager(summarize_fn=my_llm_summarize_call)
```

Both callables are plain `str -> dict` / `list[ConversationTurn] -> str`
functions — no SDK-specific type is imported by this code, so any LLM client
(including the LangChain/LangGraph setup already used elsewhere) plugs in
directly.

## Deep agent data analyst + ML training

```bash
# create a session, upload a CSV, ask it to work (deterministic router —
# see LIMITATIONS.md for why `hints` exists and how to replace it with a
# real llm_call_fn)
curl -X POST localhost:8000/analyst/sessions
curl -X POST localhost:8000/analyst/sessions/<id>/upload -F file=@data.csv
curl -X POST localhost:8000/analyst/sessions/<id>/message \
  -H 'Content-Type: application/json' \
  -d '{"message": "load and train", "hints": {"csv_path": "<path from upload>", "df_name": "df", "target": "your_target_col", "n_trials": 15}}'
curl localhost:8000/analyst/sessions/<id>/state

# train a model directly, no agent session needed
curl -X POST localhost:8000/ml/train -F file=@data.csv -F target=your_target_col -F n_trials=20
curl -X POST localhost:8000/ml/models/<model_id>/predict -H 'Content-Type: application/json' -d '[{"col1": 1, "col2": "x"}]'
```

Both are also usable as standalone LangChain tools outside this FastAPI app —
see `tools/run_python_sandbox_tool.py` and `tools/train_ml_model_tool.py`.
They import `app.*` directly (sys.path bootstrap assumes `tools/` sits next
to `backend/`, as in this layout).

## Frontend

New dependency beyond what the host app already has (recharts, framer-motion,
date-fns, wouter, lucide-react are assumed already present, matching the
original file's imports):

```bash
npm install three
npm install react-leaflet leaflet
npm install -D @types/leaflet
npm run build   # compile once
npm run watch   # auto-recompile on changes
npm run serve   # 
npm run dev     # To start the dev
```

Every backend feature now has a frontend consumer:
- **Overview tab**: dashboard grid + `DashboardPicker` (switch dashboards,
  "+ New Dashboard" button → `POST /dashboards/`)
- **ML Training tab**: `MlTrainingPanel` — upload CSV, train via Optuna, view
  leaderboard/feature importance, try predictions
- **Data Analyst tab**: `AnalystPanel` (session lifecycle + a single command
  input for standalone use in this project) + `AnalystStatePanel` (the
  reusable piece — pass it a `sessionId` and drop it next to your existing
  chat UI instead of using `AnalystPanel`'s composer)

Set `API_BASE_URL` (in `@/lib/apiEndpoints`, already referenced by the
original file) to `http://localhost:8000` for local development against the
backend above.

## Tool

`tools/dashboard_tool.py` is the LangChain `@tool` an agent calls. It emits
the same `DashboardSpec` JSON contract validated in `backend/app/models/schemas.py`
— that round-trip (tool output → Pydantic validation) was tested during this
build; see the smoke tests referenced in `LIMITATIONS.md`'s context.
