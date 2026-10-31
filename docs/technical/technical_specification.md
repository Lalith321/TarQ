# TarQ Platform — Technical Specification & Architecture

**Document Version:** 1.0.0  
**Target Audience:** Software Engineers, Systems Architects, Security Reviewers, and DevOps Engineers  
**Related Documents:** [Root README](../../README.md) | [Functional Specification](../functional/functional_specification.md)

---

## 1. System Architecture & High-Level Topology

TarQ follows a decoupled, distributed microservice architecture comprising a React/TypeScript frontend, a high-performance FastAPI backend, a LangGraph-orchestrated multi-agent state machine, a sandboxed Python execution runtime, an Optuna-driven AutoML engine, and a headless Remotion video rendering pipeline.

```mermaid
flowchart TD
    subgraph ClientLayer["Frontend Client (React 18 + Vite)"]
        UI_Home["3D WebGL Globe (Three.js)"]
        UI_Analyst["Analyst Studio & Chat (WebSocket)"]
        UI_Dash["Dynamic Dashboard Grid (Recharts/Leaflet)"]
        UI_ML["AutoML Studio & Model Console"]
        UI_Source["Data Source & Schema Explorer"]
    end

    subgraph APILayer["Backend API Gateway (FastAPI)"]
        Router_Chat["/analyst/ws (WebSocket Streaming)"]
        Router_Dash["/dashboards (CRUD & Drilldown)"]
        Router_ML["/ml (Train, Predict, Explain)"]
        Router_Schema["/schema (Introspection & Crypto)"]
        Router_Artifacts["/artifacts (Video, CSV, PDFs)"]
    end

    subgraph AgentLayer["Multi-Agent Orchestration (LangGraph)"]
        Coord["Master Coordinator Node"]
        AnalystNode["Data Analyst Agent Node"]
        NarratorNode["Narrator Agent Node"]
        Checkpointer["AsyncPostgresSaver (State Checkpointer)"]
    end

    subgraph ExecutionLayer["Execution & Computing Engine"]
        Sandbox["Python Execution Sandbox (Subprocess/Docker)"]
        AutoMLEngine["AutoML Pipeline (Optuna + Scikit-Learn)"]
        Remotion["Remotion Headless Video Renderer"]
        ContextMgr["ContextManager & Token Vault"]
    end

    subgraph DataLayer["Storage & Enterprise Infrastructure"]
        PostgresDB[("PostgreSQL (Checkpoints & Dashboards)")]
        ExtSQL[("Enterprise Remote SQL (Read-Only)")]
        FileStore["Workspace Artifacts Storage (/workspace)"]
    end

    UI_Analyst <-->|HTTP / WebSocket| Router_Chat
    UI_Dash <-->|HTTP REST| Router_Dash
    UI_ML <-->|HTTP REST| Router_ML
    UI_Source <-->|HTTP REST| Router_Schema

    Router_Chat <--> Coord
    Coord <--> Checkpointer
    Checkpointer <--> PostgresDB

    AnalystNode -->|Tool Calls| Sandbox
    AnalystNode -->|Tool Calls| ExtSQL
    AnalystNode -->|AutoML Requests| AutoMLEngine
    NarratorNode -->|Remotion Commands| Remotion

    Router_Chat --> ContextMgr
    Remotion --> FileStore
    Sandbox --> FileStore
```

---

## 2. Multi-Agent Orchestration & LangGraph State Machine

The multi-agent core is built on **LangGraph**, coordinating tasks across specialized nodes while enforcing deterministic execution boundaries and shared memory contracts.

```mermaid
stateDiagram-v2
    [*] --> MasterCoordinator
    MasterCoordinator --> DataAnalyst: Task Assigned (Data/SQL/Dashboards)
    MasterCoordinator --> Narrator: Task Assigned (Motion Video/TTS)
    MasterCoordinator --> [*]: All Tasks Complete (next == 'end')
    DataAnalyst --> MasterCoordinator: Worker Report & Artifacts Produced
    Narrator --> MasterCoordinator: Worker Report & MP4 Rendered
```

### 2.1 Shared State (`GraphState`)
State is declared in [`backend/app/agent/state.py`](file:///media/lalith/BackUp/TarQ/backend/app/agent/state.py) as an extension of `MessagesState`:

```python
class Task(TypedDict):
    id: str
    description: str
    assigned_to: Literal["Data Analyst", "Narrator"]
    status: Literal["pending", "in_progress", "completed", "blocked"]

class GraphState(MessagesState):
    artifacts: Annotated[dict[str, str], _merge_dicts]
    todo: list[Task]
    current_task: str
    selected_sources: list[dict]
    dashboard_id: Optional[str]
```

* **`artifacts`:** A merged dictionary mapping artifact keys to workspace file paths. Updates from worker nodes are unioned rather than overwritten.
* **`todo`:** The canonical task plan managed exclusively by the Master Coordinator.
* **`selected_sources`:** An allowlist of validated database schema identifiers and permitted table names attached to the user's session.
* **`dashboard_id`:** Context identifier binding generated widgets or videos to a specific dashboard view.

### 2.2 Master Coordinator Node
Located in [`backend/app/core/tarq_coord.py`](file:///media/lalith/BackUp/TarQ/backend/app/core/tarq_coord.py). The coordinator evaluates the conversation history, current todo list, and latest agent execution reports to produce a structured `TodoUpdate`:

```python
class TodoUpdate(BaseModel):
    todo: List[Task]
    next: Literal["Data Analyst", "Narrator", "end"]
    note: str
```

* **Routing Invariant:** At most one task can be `in_progress` per turn. The `next` state routes execution directly to the assigned agent. If all tasks are completed or non-recoverable blockers exist, `next` returns `"end"`, transitioning the graph to `END`.
* **Dynamic Fleet Configuration:** Agent behaviors, custom system instructions, and enabled statuses are loaded dynamically per-turn via `get_agent_config()` from [`backend/app/routers/agent_configs.py`](file:///media/lalith/BackUp/TarQ/backend/app/routers/agent_configs.py).

### 2.3 State Checkpointing & Persistence
Graph state transitions are persisted using **`AsyncPostgresSaver`** backed by connection pooling via `psycopg_pool.AsyncConnectionPool`. This enables session resumption, historical trajectory auditability, and multi-turn state retrieval across restarts.

---

## 3. Execution Sandbox & Code Isolation Engine

The analytics execution engine ([`backend/app/agent/sandbox.py`](file:///media/lalith/BackUp/TarQ/backend/app/agent/sandbox.py)) provides stateful code execution for tabular analysis, data cleaning, and statistical verification.

### 3.1 Backend Abstraction (`SandboxBackendFactory`)
The platform supports pluggable execution backends implementing the `SandboxBackend` protocol:
1. **`SubprocessSandboxBackend`:** Spawns a dedicated, long-running worker daemon process (`_session_daemon.py`) per session communicating via standard IPC streams (`stdin`/`stdout` JSON protocol).
2. **`DockerSandboxBackend`:** Dispatches commands into isolated, dedicated Docker containers via the Docker daemon API socket (`/var/run/docker.sock`).

### 3.2 Security Guardrails & AST Denylist
Before any Python code is transmitted to the execution runtime, it is parsed into an Abstract Syntax Tree (AST) and inspected:
* **Forbidden AST Nodes:** Blocks prohibited modules (`os`, `sys`, `subprocess`, `shutil`, `socket`, `pty`, `posix`, `importlib`).
* **Resource Limits (`setrlimit`):** Enforces a strict CPU time limit (`RLIMIT_CPU`) to terminate infinite loops or runaway algorithmic computations.
* **Timeout & Recovery:** Executions exceeding the configured timeout threshold (default: 30 seconds) trigger immediate SIGKILL termination of the worker process, followed by automatic recreation of a clean session daemon.

---

## 4. Tool Subsystems & Interoperability Contracts

Agents interact with the environment through standardized LangChain `@tool` implementations:

### 4.1 SQL Tool (`sql_tool.py`)
Provides deterministic database access against registered connections:
* **Strict Read-Only Enforcement:** Wraps executions in PostgreSQL read-only transaction blocks (`SET TRANSACTION READ ONLY`).
* **Timeout & Row Bounds:** Enforces a 15-second statement timeout (`SET statement_timeout = 15000`) and enforces a hard row limit of 5,000 records.
* **Allowlist Conformance:** Queries are validated to ensure they only access tables registered in `state["selected_sources"]`.

### 4.2 Dashboard Tool (`dashboard_tool.py`)
Generates structured data contracts conforming to `DashboardSpec` ([`backend/app/models/schemas.py`](file:///media/lalith/BackUp/TarQ/backend/app/models/schemas.py)):
* **Modes:**
  * **Standalone Widget:** Creates an isolated widget returned directly in the chat stream.
  * **Full Dashboard:** Synthesizes multi-widget layouts saved to PostgreSQL storage.
* **Schema Contract:** Declares widget type, X/Y axes, color schemes, data points, and nested `DrillDownConfig` specifications.

### 4.3 Python Sandbox Tool (`run_python_sandbox_tool.py`)
Binds the stateful sandbox to the agent's toolbelt, allowing incremental pandas transformations (`df = pd.read_csv(...)` followed by subsequent queries on `df` in later turns).

### 4.4 Narrator Tool (`narrator_tool.py`)
Provides APIs for inspecting analysis artifacts, generating TTS audio files, modifying Remotion compositions, and invoking headless video compilation.

---

## 5. Automated Machine Learning (AutoML) Subsystem

The AutoML engine located in [`backend/app/ml/`](file:///media/lalith/BackUp/TarQ/backend/app/ml/) executes autonomous model training without human intervention:

```
Raw CSV Upload
     │
     ▼
[problem_type.py] ──> Evaluates target cardinality & dtypes
     │                Outputs: CLASSIFICATION (Binary/Multi) or REGRESSION
     ▼
[preprocessing.py] ──> Constructs ColumnTransformer
     │                 - Numerical: SimpleImputer(median) + StandardScaler
     │                 - Categorical: SimpleImputer(most_frequent) + OneHotEncoder
     ▼
[search_space.py] ──> Declares hyperparameter search spaces across:
     │                - Logistic Regression / Ridge
     │                - Random Forest
     │                - Gradient Boosting
     ▼
[trainer.py] ───────> Executes Optuna Study (Bayesian Optimization)
     │                - Cross-Validation (5-fold Stratified / K-Fold)
     │                - Optimization Objective: F1 / Accuracy / RMSE
     ▼
[registry.py] ──────> Serializes best pipeline (.joblib) to /workspace/models
     │
     ▼
[explain.py] ───────> Post-hoc feature importance & natural language explanation
```

* **Deterministic Pipeline:** Hyperparameter tuning and model selection are 100% mathematical and code-driven; LLMs are never placed in the optimization loop.
* **Model Registry:** Trained pipelines are persisted with metadata and exposed via `/ml/models/{model_id}/predict` for real-time inference.

---

## 6. Autonomous Motion Video Rendering Pipeline

The **Narrator** subsystem renders dynamic MP4 video briefings using **Remotion** (React-based video framework) located in [`workspace/remotion_app/`](file:///media/lalith/BackUp/TarQ/workspace/remotion_app/):

1. **Narration & TTS Generation:**
   * Narrator writes a factual script based on verified data artifacts.
   * Synthesizes audio using a Text-to-Speech engine, generating an audio track stored in `workspace/remotion_app/public/`.
2. **Metadata & Frame Duration Calculation:**
   * Remotion's `calculateMetadata` dynamically inspects the generated audio file's duration.
   * Computes exact composition frame counts: `durationInFrames = ceil(audioDurationSeconds * fps)`.
3. **Motion Graphics Synthesis:**
   * Generates or updates React compositions (`Composition.tsx`), mapping data points to animated SVG charts, bar reveals, and metric cards.
4. **Headless Compilation:**
   * Spawns a headless Remotion CLI process (`npx remotion render`) that compiles the React component tree into a standard 1080p MP4 artifact served via `/artifacts/videos/`.

---

## 7. Context Management & Artifact Vault

Located in [`backend/app/core/context_manager.py`](file:///media/lalith/BackUp/TarQ/backend/app/core/context_manager.py), this subsystem manages token boundaries for long-running sessions:
* **Token Budgeting:** Tracks token usage across conversation turns. When cumulative tokens exceed the budget threshold, an automated compression cycle triggers.
* **Dual-Path Summarization:** Condenses historical conversational turns into memory blocks using an injected LLM summarizer or a fast extractive heuristic fallback.
* **Artifact Vault Segregation:** Large structured tool outputs (such as extensive SQL datasets, full CSV files, or ML trial reports) are saved to the persistent workspace and referenced by pointer rather than injected into conversational context turns.

---

## 8. Database Persistence & Cryptographic Security

### 8.1 Database Storage
* **Production PostgreSQL:** Checkpoint states, saved dashboards, and schema metadata reside in PostgreSQL within dedicated database schemas (`workspace`).
* **SQLite Fallback:** Local development automatically supports SQLite via `dashboard_platform.db`.

### 8.2 Credential Encryption at Rest
External database credentials (passwords, connection strings) are encrypted at rest using AES-GCM / Fernet cryptography implemented in [`backend/app/services/credential_crypto.py`](file:///media/lalith/BackUp/TarQ/backend/app/services/credential_crypto.py):
* Uses the environment variable `CREDENTIAL_ENCRYPTION_KEY`.
* In development environments without an explicit key, a deterministic fallback key is derived from the primary `DATABASE_URL`.
* Plaintext credentials are never stored in the database, never returned via API responses, and never passed into LLM prompt contexts.

---

## 9. Comprehensive API Reference

### 9.1 Analyst & Multi-Agent Endpoints

| Method | Endpoint | Description | Request / Response Payload |
| :--- | :--- | :--- | :--- |
| `POST` | `/analyst/sessions` | Creates a new analysis session. | Response: `{"session_id": "abc123"}` |
| `WS` | `/analyst/ws/{session_id}` | WebSocket streaming connection. | Streams token chunks, thoughts, todo list updates, and artifacts. |
| `POST` | `/analyst/sessions/{id}/message` | Sends a message to the agent. | Body: `{"message": str, "hints": Optional[dict]}` |
| `POST` | `/analyst/sessions/{id}/upload` | Uploads a CSV to the session sandbox. | Multipart file upload. |
| `GET` | `/analyst/sessions/{id}/state` | Returns the current session state. | Response: Virtual files, loaded dataframes, message history. |

### 9.2 Dashboard Endpoints

| Method | Endpoint | Description | Request / Response Payload |
| :--- | :--- | :--- | :--- |
| `GET` | `/dashboards/` | Lists all registered dashboards. | Response: `list[DashboardSpec]` |
| `POST` | `/dashboards/` | Creates a new dashboard. | Body: `DashboardSpec` |
| `GET` | `/dashboards/{id}` | Retrieves a specific dashboard. | Response: `DashboardSpec` |
| `PATCH` | `/dashboards/{id}` | Updates dashboard metadata/widgets. | Body: `DashboardUpdate` |
| `DELETE`| `/dashboards/{id}` | Deletes a dashboard. | Status: `204 No Content` |
| `POST` | `/dashboards/{id}/widgets/{w_id}/data` | Executes live SQL query for widget. | Returns executed query result rows. |
| `POST` | `/dashboards/{id}/widgets/{w_id}/drilldown` | Executes parameterized drill-down query. | Body: Key-value map of clicked row values. Returns `WidgetSpec`. |
| `GET` | `/dashboards/{id}/report/pdf` | Generates an executive PDF report. | Returns raw PDF binary stream (`application/pdf`). |

### 9.3 Machine Learning (AutoML) Endpoints

| Method | Endpoint | Description | Request / Response Payload |
| :--- | :--- | :--- | :--- |
| `POST` | `/ml/train` | Trains an AutoML model on an uploaded CSV. | Form data: `file`, `target`, `n_trials` (default: 20). Returns `TrainResult`. |
| `POST` | `/ml/models/{id}/predict` | Runs inference against a trained model. | Body: `list[dict[str, Any]]` (features). Returns `list[prediction]`. |
| `POST` | `/ml/models/{id}/explain` | Generates post-hoc textual explanation. | Returns executive markdown summary. |

### 9.4 Schema & Data Source Endpoints

| Method | Endpoint | Description | Request / Response Payload |
| :--- | :--- | :--- | :--- |
| `POST` | `/schema/connect` | Tests connection & introspects tables. | Body: Connection credentials. Returns table schemas. |
| `GET` | `/schema/list` | Lists all registered data sources. | Response: `list[SchemaMetadata]` |
| `GET` | `/schema/{id}` | Retrieves schema details & tables. | Response: `SchemaMetadata` |

### 9.5 Artifact & Document Endpoints

| Method | Endpoint | Description | Request / Response Payload |
| :--- | :--- | :--- | :--- |
| `GET` | `/artifacts/{category}/{filename}` | Streams artifact binary (MP4, CSV, PNG).| Binary file response. |
| `POST` | `/documents/upload` | Ingests PDF/DOCX/TXT for insight extraction.| Returns extracted insights and confidence flag. |
| `GET` | `/agent-configs/` | Retrieves current agent fleet configurations. | Returns coordinator, analyst, and narrator configs. |
| `PUT` | `/agent-configs/{name}` | Updates prompt instructions or enabled status. | Body: `AgentConfigUpdate`. |

---

## 10. Frontend Engineering & Architecture

* **Framework:** React 18 with TypeScript, bundled using **Vite**.
* **Styling & Components:** TailwindCSS utility engine combined with custom UI component primitives.
* **3D Visualizations:** Three.js WebGL canvas rendering a photo-realistic Earth with atmospheric shaders, raycaster hover cards, and orbital controls (`frontend/src/features/hero/`).
* **Charts & Analytics:** Recharts for vector SVG charts (Line, Bar, Area, Pie) and Leaflet for geospatial tile rendering (`frontend/src/features/dashboard/components/widgets/`).
* **Real-Time Client:** React hooks (`useDashboardAgent.ts`) managing WebSocket lifecycles, reconnect backoff, and asynchronous stream assembly.

---

## 11. Deployment, Dockerization & DevOps

The platform is designed for zero-configuration containerized deployment via Docker and Docker Compose.

```
                  ┌──────────────────────────────┐
                  │    Docker Host (tarq-net)    │
                  └──────────────┬───────────────┘
                                 │
     ┌───────────────────────────┼───────────────────────────┐
     ▼                           ▼                           ▼
┌──────────────┐          ┌──────────────┐          ┌──────────────┐
│ tarq-frontend│          │ tarq-backend │          │   postgres   │
│  (Port 5173) │          │  (Port 8000) │          │  (Port 5432) │
└──────────────┘          └──────┬───────┘          └──────────────┘
                                 │
                         /var/run/docker.sock
                                 ▼
                     ┌───────────────────────┐
                     │ Docker Engine Sandbox │
                     │  (Worker Containers)  │
                     └───────────────────────┘
```

### 11.1 Container Specification
* **`Dockerfile.backend`:** Python 3.12-slim base image, multi-stage dependency installation, Uvicorn ASGI server with live reloading enabled.
* **`Dockerfile.frontend`:** Node 22 base image running Vite in dev/host mode.
* **Volume Mounts:**
  * `./workspace:/workspace`: Shared artifact directory across backend, Remotion, and sandbox processes.
  * `/var/run/docker.sock:/var/run/docker.sock`: Allows backend to orchestrate isolated Docker worker containers.

### 11.2 Environment Configuration Matrix (`backend/.env`)

| Variable | Required | Description | Example |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Yes | PostgreSQL connection string for checkpointer and storage. | `postgresql://user:pass@postgres:5432/tarq` |
| `TARQ_WORKSPACE_DIR` | Yes | Absolute path to persistent workspace directory. | `/media/lalith/BackUp/TarQ/workspace` |
| `CREDENTIAL_ENCRYPTION_KEY` | Optional | Stable encryption key for saved SQL credentials. | Base64 32-byte key |
| `ANTHROPIC_API_KEY` | Optional | API key for Anthropic Claude LLM models. | `sk-ant-...` |
| `OPENAI_API_KEY` | Optional | API key for OpenAI GPT LLM models. | `sk-...` |
| `GOOGLE_API_KEY` | Optional | API key for Google Gemini LLM models. | `AIzaSy...` |
