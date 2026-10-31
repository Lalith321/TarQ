# TarQ Backend Service

High-performance FastAPI service powering the TarQ Agentic Intelligence Platform. Orchestrates LangGraph multi-agent workflows, code execution sandboxes, Optuna AutoML training, PostgreSQL state persistence, and dynamic dashboard synthesis.

---

## Architecture Overview

* **Framework:** FastAPI with Uvicorn ASGI runtime.
* **Agent Framework:** LangGraph 1.2+ state machines with `AsyncPostgresSaver` checkpointer.
* **Analysis Sandbox:** Pluggable execution runtime (`_session_daemon.py` or isolated Docker worker containers).
* **Machine Learning:** Automated ML training using Scikit-learn pipelines and Optuna Bayesian optimization.
* **Data Layer:** PostgreSQL (production) with SQLite fallback, connection pooling via `psycopg_pool`, and AES-GCM credential encryption.

For deep architectural details, see the [Technical Specification](../docs/technical/technical_specification.md).

---

## Directory Structure

```
backend/
├── app/
│   ├── agent/             # Multi-agent LangGraph nodes & execution runtime
│   │   ├── coordinator.py # Session coordinator wrapper
│   │   ├── data_analyst.py# Data analyst agent node (SQL, Python, Viz)
│   │   ├── narrator.py    # Narrator agent node (Remotion & TTS)
│   │   ├── sandbox.py     # Code execution engine & AST safety checks
│   │   └── state.py       # GraphState & Todo data models
│   ├── core/              # Shared core modules (tarq_coord, context_manager, workspace_paths)
│   ├── db/                # Database initialization & connections
│   ├── ml/                # AutoML pipeline (problem_type, preprocessing, search_space, trainer, registry)
│   ├── models/            # Pydantic schemas (DashboardSpec, WidgetSpec, DrillDownConfig)
│   ├── routers/           # FastAPI routers (chat, analyst, dashboard, ml, artifacts, schema, logs)
│   ├── services/          # Business services (dashboard_service, credential_crypto, report_service)
│   ├── tools/             # LangChain tools (dashboard_tool, sql_tool, run_python_sandbox_tool, narrator_tool)
│   ├── llm_config.py      # LLM factory (Anthropic, OpenAI, Google GenAI)
│   └── main.py            # FastAPI application entrypoint & lifecycle
├── tests/                 # Integration and unit tests
├── requirements.txt       # Python dependencies
└── pyproject.toml         # Build metadata
```

---

## Setup & Local Development

### 1. Prerequisites
* Python 3.12+
* Docker (for sandbox containerization and PostgreSQL)
* PostgreSQL 15+ (or Docker)

### 2. Virtual Environment Setup
```bash
# From the backend directory
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Environment Variables
Ensure a `.env` file exists in `backend/`:
```bash
# Database connection for LangGraph checkpointer and dashboard storage
DATABASE_URL=postgresql://tarq:tarq@localhost:5432/tarq

# Workspace directory for persistent artifacts (must be an absolute path)
TARQ_WORKSPACE_DIR=/path/to/TarQ/workspace

# Optional: Dedicated stable encryption key for external database passwords
CREDENTIAL_ENCRYPTION_KEY=

# Optional: LLM Provider Keys
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GOOGLE_API_KEY=
```

### 4. Running the Server
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Verify service health:
```bash
curl http://localhost:8000/health
# Output: {"status": "ok"}
```

Interactive Swagger documentation is available at [http://localhost:8000/docs](http://localhost:8000/docs).

---

## Running Tests

Tests are executed with `pytest`:

```bash
# Run all tests
pytest tests/ -v

# Run specific test modules
pytest tests/test_agent_routes.py -v
pytest tests/test_sql_tool_sandbox.py -v
pytest tests/test_dashboard_persistence.py -v
pytest tests/test_artifacts.py -v
```

---

## Key Subsystems

### 1. LangGraph Multi-Agent Engine
The entrypoint for the compiled graph is `build_compiled_graph()` in [`app/core/tarq_coord.py`](file:///media/lalith/BackUp/TarQ/backend/app/core/tarq_coord.py).
* `master_coordinator`: Evaluates progress, maintains the Todo list, and routes turns.
* `data_analyst_node`: Executes SQL queries, runs pandas analysis in the sandbox, and emits `DashboardSpec` widgets.
* `narrator`: Dispatches Remotion video rendering and TTS voiceover generation.

### 2. Execution Sandbox
The sandbox runtime in [`app/agent/sandbox.py`](file:///media/lalith/BackUp/TarQ/backend/app/agent/sandbox.py) enforces:
* AST inspection to block prohibited modules (`subprocess`, `os`, `sys`, `socket`).
* Resource bounds (`RLIMIT_CPU`) to terminate runaway executions.
* Long-lived session worker processes (`_session_daemon.py`) preserving dataframe variables across calls.

### 3. AutoML Engine
Accessible via `/ml/train` or tool calling from the Data Analyst:
* Automatically detects classification or regression from dataset properties.
* Builds Scikit-Learn `ColumnTransformer` preprocessing pipelines.
* Executes Bayesian hyperparameter optimization with Optuna over K-Fold splits.
* Persists winning models via `joblib` in `$TARQ_WORKSPACE_DIR/models/`.

### 4. Credential Encryption
External database connection passwords are encrypted at rest with AES-GCM / Fernet via [`app/services/credential_crypto.py`](file:///media/lalith/BackUp/TarQ/backend/app/services/credential_crypto.py). Saved credentials are never sent to LLMs or exposed in API responses.
