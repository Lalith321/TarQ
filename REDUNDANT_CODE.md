# Redundant / Unused Code — Pending Removal

All items below are superseded by the LangGraph approach (`chat.py` + WebSocket).
Do NOT remove until end-to-end testing confirms the new wiring works.

---

## Backend

### `backend/app/routers/agent.py`
- **What it is:** Sync REST router. Single endpoint `POST /agent/dashboard-chat`.
- **What it did:** Called `data_analyst_agent.invoke()` directly (bypassing the Master Coordinator and Narrator), returned a structured `{kind, reply, widget, widgets}` response.
- **Why redundant:** `chat.py` WebSocket (`/analyst/sessions/{id}/ws`) runs the full LangGraph graph (Coordinator → Data Analyst → Narrator) with Postgres persistence. The old endpoint skipped the coordinator entirely.
- **Safe to delete when:** `useDashboardAgent` and `QuickDashboardButton` are confirmed working via WebSocket.

### `backend/app/routers/analyst.py`
- **What it is:** REST router for `DeepDataAnalystAgent` (in-memory, no LangGraph).
- **Endpoints:**
  - `POST /analyst/sessions` — created an in-memory `DeepDataAnalystAgent` instance
  - `POST /analyst/sessions/{id}/upload` — uploaded CSV to temp dir
  - `POST /analyst/sessions/{id}/message` — sent message + hints dict
  - `GET /analyst/sessions/{id}/state` — returned `{rendered, files, dataframes, todos, context_turns, context_memory_blocks, artifacts}`
  - `DELETE /analyst/sessions/{id}` — shut down in-memory agent
- **Why redundant:** `chat.py` replaces all of these with LangGraph + Postgres checkpointer. The `GET /analyst/sessions/{id}/state` route in `chat.py` now conflicts with this one (same path, different router — whichever is registered first in `main.py` wins silently).
- **Note:** `main.py` currently does NOT import `analyst.py` — only `chat.py` is mounted. So there is no live collision, but the file is dead code.
- **Safe to delete when:** Confirmed `main.py` never imports it (already the case).

---

## Frontend

### `frontend/src/services/dashboardService.ts` — `sendAgentMessage()` and `quickDashboard()`
- **Lines:** `sendAgentMessage` (line ~73), `quickDashboard` (line ~95)
- **What they did:** Called `POST /agent/dashboard-chat` and `POST /agent/quick-dashboard` respectively.
- **Why redundant:** `useDashboardAgent` and `QuickDashboardButton` now call `streamAnalystMessage` from `analystService.ts` instead.
- **No callers remain** — confirmed by grep.
- **Safe to delete when:** Build compiles without errors after removal.

### `frontend/src/services/analystService.ts` — `closeAnalystSession()`
- **What it does:** Calls `DELETE /analyst/sessions/{id}`.
- **Current status:** Exported but not called anywhere in the frontend.
- **Keep or remove:** Keep for now — useful for cleanup on session end. Wire it to a component unmount or explicit "End Session" action when needed.

---

## Summary Table

| File | Item | Status |
|------|------|--------|
| `routers/agent.py` | Entire file | Dead — safe to delete after testing |
| `routers/analyst.py` | Entire file | Dead — not mounted, safe to delete |
| `dashboardService.ts` | `sendAgentMessage()` | No callers — delete after build check |
| `dashboardService.ts` | `quickDashboard()` | No callers — delete after build check |
| `analystService.ts` | `closeAnalystSession()` | Unused but useful — keep, wire later |
