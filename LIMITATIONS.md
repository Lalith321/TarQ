# Limitations & Hurdles

Written the way I'd want it written for me — what's real, what's stubbed,
and what a genuine production deployment still needs.

## Auth (by instruction, not by accident)
No login, no user model, no API keys anywhere in this build — you asked for
that explicitly. CORS is wide open (`allow_origins=["*"]`) to match. Every
place auth will eventually need to hook in is marked with a comment
(`dashboardService.ts` for headers, `main.py` for CORS tightening, a
`get_current_user` dependency on the routers). None of the drill-down or
context-session logic assumes a user id, so adding auth later is additive,
not a rewrite.

## Saved SQL credentials
SQL passwords are stored separately from schema metadata and encrypted at
rest using `CREDENTIAL_ENCRYPTION_KEY`. If that variable is not configured,
the key is derived from `DATABASE_URL` for local development; set an explicit,
stable key in deployed environments and keep it backed up. Changing the key
makes previously saved credentials unreadable, so those sources must be
reconnected.

## GIS
- **No map API key used on purpose** — tiles come from the public
  OpenStreetMap tile server. That's fine for development, but OSM's tile
  usage policy explicitly isn't meant for production traffic at any real
  volume. A real deployment needs a tile provider (Mapbox, MapTiler, Google
  Maps) with its own key — which conflicts with "no keys for now," so it's
  left as the OSM fallback with this caveat.
- **No geocoding.** The GIS widget and the `dashboard_tool` both require
  `lat`/`lng` (or a region id for choropleth) already present in the data.
  If an agent is only given place names, nothing here turns "Mumbai" into
  coordinates — that's a separate tool to add.
- **"Heatmap" is an approximation.** It's weight-scaled circle markers, not
  a true density surface (kernel density estimation via `leaflet.heat`).
  Real heatmap rendering was left out rather than silently added as a new
  frontend dependency you didn't ask for — swap `GisWidget.tsx`'s marker
  loop for `leaflet.heat` if you want the real thing.
- **Choropleth needs a boundary file you provide.** `boundary_geojson_url`
  is fetched client-side as-is; there's no bundled world/country/state
  boundary set, and no validation that `region_id_field` actually matches
  the properties in that GeoJSON.

## Drill-downs
- Dashboard and drill-down queries now resolve a saved PostgreSQL source by
  `schema_id`, use its separately encrypted password, bind parameters, enforce
  a PostgreSQL read-only transaction, set a 15-second statement timeout, and
  return at most 5,000 rows. Query-backed widget result rows are not persisted;
  opening or refreshing the dashboard executes the saved query again.
- The app currently has no authentication or per-user source ownership. Until
  that is added, do not expose the API to untrusted users: anyone who can reach
  the dashboard endpoints may access registered sources through saved queries.
- Read-only transactions prevent writes, but there is no column-level permission
  model or query-plan cost limit. Use dedicated least-privilege database users,
  and limit the tables they can read at the database level.

## Agentic context management
- `ContextManager`'s summarizer defaults to a first-sentence extractive
  fallback when no `summarize_fn` is injected — it's there so the class is
  testable without a live model, not as a real compression strategy. Inject
  an LLM-backed summarizer in production.
- Token counting is `len(text) // 4`, not a real tokenizer. Swap in
  `tiktoken` (or whatever matches the model actually in use) before trusting
  the budget math for anything that matters.
- Memory-block retrieval is keyword overlap, not embeddings. It works for
  the demo but won't generalize past small memory sets. The existing stack
  already uses Weaviate elsewhere for RAG — that's the natural place to
  plug in real retrieval here instead of the keyword scorer.
- Sessions live in a plain in-memory dict (`_sessions` in
  `routers/context.py`) — they're gone on restart. Fine for a single-process
  dev server, not for anything that needs to survive a redeploy.

## Document insight extraction
- Without an injected `extract_fn`, the pipeline runs a regex/heuristic
  fallback (`_heuristic_fallback_extract`) so the endpoint never 500s on a
  real upload — but it will find almost nothing (a handful of numbers, a
  truncated summary). Every response is stamped `low_confidence: true` in
  that case so the frontend can flag it, which it does. Wire a real LLM
  callable into `DocumentInsightExtractor(extract_fn=...)` before trusting
  extraction quality.
- **No OCR.** A scanned PDF (image-only pages) will extract to empty text
  via `pypdf` and produce an empty insight bundle. Wiring OCR (e.g.
  `pytesseract`) is a real gap, not a hypothetical one, if scanned documents
  are expected input.
- Chunking is fixed-size character windows with overlap, not
  structure-aware (no paragraph/table boundary detection). It's what makes
  the pipeline format-agnostic, but it also means a chunk can occasionally
  split a sentence or a table row — the overlap window is there specifically
  to reduce, not eliminate, that.
- Uploaded files are written to the OS temp dir and never cleaned up in this
  build — add a retention/cleanup job before this runs unattended for long.

## Frontend
- `DashboardGrid` places widgets on a CSS grid using each widget's
  `position` — there's no drag-and-drop resize/rearrange UI. The backend is
  the source of truth for layout.
- `ExecutiveView`, `InfrastructureHealth`, `McpEcosystem`, `AgentOperations`,
  `DataPipeline`, `AiInsights`, `IndustryTemplates`, `QuickLinks` — the other
  eight tabs from the original file — are left as-is (imported, not
  rewritten). They still don't consume the `DashboardSpec` contract; only
  the Overview tab was reworked onto it in this pass. Bringing the other
  tabs onto the same contract is the natural next step, not done here to
  keep this change reviewable.
- No test suite is included (the backend logic above was exercised manually
  via `TestClient` during this build, not left as committed tests).

## Frontend coverage (added after a direct audit — see below)
A cross-reference of every `fetch()` call against every registered backend
endpoint turned up that only 3 of 17 endpoints had a frontend consumer
(dashboard fetch, drilldown, document upload) — `/ml/*`, `/analyst/*`,
`/context/*`, and dashboard list/create were backend+tool-only. This pass
added:
- `DashboardPicker.tsx` — dashboard switcher + a "+ New Dashboard" button
  (`POST /dashboards/`), the "quick dashboard" button that was missing.
- `MlTrainingPanel.tsx` — upload a CSV, train, see the Optuna leaderboard
  and feature importance, try a prediction. Full `/ml/*` coverage.
- `AnalystStatePanel.tsx` + `AnalystPanel.tsx` — deliberately **not** a new
  chat component (an existing one was already available in the host app).
  `AnalystStatePanel` is the reusable piece: pass it a `sessionId` and drop
  it next to whatever chat UI already calls `analystService.ts`. `AnalystPanel`
  is a thin session-lifecycle + single-command wrapper that exists only so
  this project's own "Data Analyst" tab is usable standalone; it is not
  meant to replace a real chat interface.
- `/context/*` still has no frontend — it's meant to be used server-side by
  whatever wires a real `llm_call_fn` into the agent, not something an end
  user interacts with directly.

None of the new frontend code has been run against a live bundler/host app
(no `package.json`/`node_modules` for the actual host project exists in this
sandbox) — every file was syntax/bundle-checked individually with `esbuild`
(catches broken JSX, unbalanced braces, bad imports-as-syntax), which is not
the same as a full typecheck against the host app's `tsconfig` paths
(`@/components/ui/*` etc. are assumed, not verified, to exist and match the
props used here — same assumption the original file already made).


- **Sandbox isolation is a denylist + CPU rlimit, not a jail.** No seccomp,
  no namespaces, no memory limit (RLIMIT_AS was tried and rejected —
  numpy/BLAS reserve large virtual address ranges on import regardless of
  actual usage, so it kills legitimate code, not just runaway code). The
  denylist blocks direct `import os`/`subprocess`/`open`/etc. in submitted
  code, but not what a library does internally — `pd.read_csv` can still
  read any path the process can see. Treat this as "keeps an LLM from
  typing something obviously dangerous," not as "safe to run arbitrary
  untrusted code." Real isolation needs one container per session — the
  existing stack already uses Docker Compose elsewhere, which is the
  natural place to move this.
- **A sandbox timeout loses the session's variables.** The worker process is
  killed and restarted on timeout by design (a hung process shouldn't hang
  the session forever), but that means a long-running legitimate computation
  and an infinite loop are indistinguishable from the outside — both reset
  state. There's no checkpointing.
- **No real LLM is wired into `DeepDataAnalystAgent` by default.**
  `llm_call_fn` is `None` unless you inject one; without it, the agent only
  responds to the `hints` dict via `_deterministic_router` — a fixed-path
  stand-in that proves the sandbox/state/context wiring works end-to-end,
  not a planner. Wiring a real model means writing a `list[dict] -> str`
  function that returns the `{"tool": ..., "args": ...}` / `{"final_answer":
  ...}` JSON convention this build uses — or replacing that convention with
  your LLM provider's native tool-calling format, which is a more direct fit
  for production than the JSON-in-text convention used here.
- **Sessions and dataframes are in-memory, one `Sandbox` worker process per
  session.** Nothing survives a backend restart, and there's no cap on how
  many sessions can pile up worker processes — add a session TTL/eviction
  policy before this runs unattended.
- **No sub-agent spawning.** Deep-agent designs often isolate sub-tasks in a
  fresh context to avoid polluting the parent's — not implemented here to
  keep this pass scoped to what was asked (sandbox, state injection, context
  management). The tool-call loop is a single flat agent.

## ML training system
- **sklearn-only candidate models** (logistic/ridge, random forest, gradient
  boosting) — no xgboost/lightgbm, so as not to assume dependencies beyond
  what this build installs. Adding a candidate is one entry in
  `search_space.py`; the trainer loop doesn't care how many there are.
- **CV-score-based model selection can still overfit** on small datasets —
  standard k-fold cross-validation, no nested CV, no explicit holdout set
  enforced by the API (the caller's CSV is used for both search and the
  final fit). For anything that matters, hold out a test set before calling
  `/ml/train` and evaluate the returned model against it yourself.
- **Feature importance is best-effort**: `feature_importances_`/`coef_` when
  the winning model exposes one, empty dict otherwise. No SHAP/permutation
  importance fallback for models that don't expose either.
- **The model registry is in-memory + local temp-dir joblib files** — gone on
  restart, no versioning, no cleanup job. Fine for a dev/demo loop, not for
  anything that needs trained models to survive a redeploy.
- **`explain_fn` is untested against a real LLM** in this build (only a fake
  callable in the smoke test) — the JSON-in/prose-out contract is simple by
  design, but hasn't been run against an actual model's occasionally-messy
  output the way `insight_extractor`'s JSON-repair path has.

SQLite-by-default with a one-line Postgres swap, in-memory stores where
persistence wasn't the point of this pass, no new frontend dependencies
beyond `react-leaflet` for GIS — all to keep the diff reviewable rather than
introducing a parallel stack alongside the existing one.
