# TarQ — Agentic Dashboard & Intelligence Platform

[![Python](https://img.shields.io/badge/Python-3.12+-3776AB?style=flat&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18+-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev/)
[![LangGraph](https://img.shields.io/badge/LangGraph-1.2+-FF6F00?style=flat&logo=chainlink&logoColor=white)](https://langchain-ai.github.io/langgraph/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat&logo=docker&logoColor=white)](https://www.docker.com/)

**TarQ** is an enterprise-grade agentic data intelligence platform. It unifies conversational multi-agent workflows, natural language SQL querying, an automated machine learning (AutoML) studio, interactive real-time dashboards, and autonomous motion video presentations with synchronized voiceover into a cohesive, high-performance platform.

---

## 📖 Complete Documentation Suite

To serve different needs, TarQ maintains strictly separated documentation tracks:

* 📘 **[Functional Specification](docs/functional/functional_specification.md):** User personas, business capabilities, interactive workflows, and end-to-end product scenarios.
* 🛠️ **[Technical Specification](docs/technical/technical_specification.md):** Deep system architecture, LangGraph state machine, execution sandboxing, tool schemas, AutoML pipeline, Remotion video engine, and complete API reference.
* 🐍 **[Backend Engineering Guide](backend/README.md):** Developer setup, test execution, database initialization, and local service configuration.
* 📑 **[Documentation Portal](docs/README.md):** Master index and navigation guide for all documentation.

---

## 🚀 Key Features

* **🤖 Autonomous Multi-Agent Fleet:**
  * **Master Coordinator:** Decomposes complex user goals into an auditable, real-time Todo task plan.
  * **Data Analyst Agent:** Inspects databases, executes queries, and calculates verified metrics in an isolated Python sandbox.
  * **Narrator Agent:** Transforms analytical findings into presentation-quality motion videos rendered via Remotion with synchronized TTS voiceover.
* **📊 Dynamic Agentic Dashboards:**
  * Data-driven rendering from unified `DashboardSpec` contracts.
  * 7+ built-in widget types: Bar, Stacked Bar, Line, Multi-Line, Pie, Area, Table, Stat KPI, and GIS Geospatial maps.
  * Parameterized click-to-drilldown into underlying SQL sources and one-click PDF report exports.
* **🧠 Automated Machine Learning (AutoML) & Time Series Studio:**
  * **Tabular AutoML Engine:** Automated problem classification (Classification vs. Regression), preprocessing pipelines, scaling, imputation, and Optuna Bayesian hyperparameter optimization across Random Forest, Gradient Boosting, Hist Gradient Boosting, Extra Trees, Neural Networks (MLP), and Linear/Logistic models.
  * **Deep Time Series Studio:** Multi-horizon neural sequence forecasting (LSTM, GRU, TCN, Attention Transformer, N-BEATS) with configurable lookback windows, lead horizons, epoch convergence loss tracking, and confidence interval projections.
  * **Model Diagnostics & Explainability:** Interactive confusion matrices, ROC-AUC, regression residual statistics, actual vs predicted scatter plots, global feature importance bars, and local sample waterfall attribution.
  * **Batch & Real-Time Inference Console:** Browser-based single-row inference, automated local prediction explanation, and bulk CSV batch inference with annotated output downloads.
* **☁️ AWS SageMaker Cloud Hub (Configurable / Simulation-Ready):**
  * Configurable AWS credentials, target cloud regions, and S3 artifact storage with dual Live Cloud and zero-cost Simulation Sandbox modes.
  * Remote distributed training job launcher with EC2 compute instance selection (`ml.m5.xlarge`, `ml.c5.xlarge`, `ml.g4dn.xlarge`).
  * Real-time SageMaker HTTPS inference endpoint deployment, sub-20ms latency monitoring, live invocation test console, and 1-click endpoint teardown to prevent unexpected cloud charges.
  * Standalone container export generating production-ready `sagemaker_model.tar.gz` bundles complete with `inference.py` hooks and `Dockerfile.sagemaker`.
* **🎬 Autonomous Video Storytelling:**
  * Programmatic video synthesis using the Remotion React engine.
  * Automated voiceover narration aligned frame-by-frame with animated charts and exported as 1080p MP4s.
* **🌍 3D Global Data World:**
  * Interactive Three.js WebGL Earth globe with custom atmospheric shaders, coordinate raycasting, and live hover data cards.
* **🔒 Enterprise Security & Isolation:**
  * Read-only SQL transaction enforcement and statement timeouts.
  * AES-GCM / Fernet encrypted credential storage for saved data sources.
  * AST code inspection and CPU limits for sandbox Python execution.

---

## ⚡ Quick Start

### Option 1: Docker (Recommended)

Run the full platform (PostgreSQL, FastAPI Backend, React Frontend, and Worker Sandbox) with a single command:

```bash
# Ensure execution permissions
chmod +x start.sh

# Start all services
./start.sh
```

* **Frontend UI:** Open [http://localhost:5173](http://localhost:5173)
* **Backend API Docs (Swagger):** Open [http://localhost:8000/docs](http://localhost:8000/docs)
* **Health Check:** `curl http://localhost:8000/health` → `{"status": "ok"}`

To stop the containers:
```bash
docker stop tarq-frontend tarq-backend postgres
```

---

### Option 2: Local Native Development

#### 1. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env  # or edit .env directly

# Start FastAPI server
uvicorn app.main:app --reload --port 8000
```

#### 2. Frontend Setup

```bash
cd frontend

# Install node dependencies
npm install

# Start Vite dev server
npm run dev
```

The frontend will start at [http://localhost:5173](http://localhost:5173).

---

## 📁 Repository Structure

```
TarQ/
├── backend/                    # FastAPI service & analytical core
│   ├── app/
│   │   ├── agent/              # LangGraph multi-agent nodes & sandboxes
│   │   │   ├── coordinator.py  # Master Coordinator planning logic
│   │   │   ├── data_analyst.py # Data Analyst agent node (SQL, Python, Viz)
│   │   │   ├── narrator.py     # Narrator agent node (Remotion & TTS)
│   │   │   ├── sandbox.py      # Code execution runtime & AST security
│   │   │   └── state.py        # Shared GraphState & Todo definitions
│   │   ├── core/               # Context manager, token compression & coords
│   │   ├── db/                 # Database initialization & connections
│   │   ├── ml/                 # AutoML engine (Optuna, Preprocessing, Registry)
│   │   ├── models/             # Pydantic schemas (DashboardSpec, WidgetSpec)
│   │   ├── routers/            # FastAPI REST & WebSocket endpoints
│   │   ├── services/           # Business logic & encrypted credential storage
│   │   └── tools/              # LangChain tools (SQL, Sandbox, Dashboard, ML)
│   ├── tests/                  # Backend unit & integration test suite
│   ├── Dockerfile.backend      # Backend container definition
│   └── requirements.txt        # Python package dependencies
├── frontend/                   # React 18 + TypeScript + Vite SPA
│   ├── src/
│   │   ├── features/
│   │   │   ├── analyst/        # Analyst workspace & chat components
│   │   │   ├── dashboard/      # Dynamic dashboard grid & widget renderers
│   │   │   ├── hero/           # Three.js 3D Earth globe visualization
│   │   │   └── ml/             # AutoML studio panel & model console
│   │   ├── pages/              # Application views & landing layouts
│   │   └── services/           # Frontend API client services
│   ├── Dockerfile.frontend     # Frontend container definition
│   └── package.json            # Node dependencies & build scripts
├── docs/                       # Project documentation
│   ├── README.md               # Documentation master index
│   ├── functional/             # Functional specifications & user guides
│   └── technical/              # Technical architecture & API reference
├── workspace/                  # Persistent runtime storage (artifacts, models)
│   ├── artifacts/              # Rendered MP4 videos and exported charts
│   ├── models/                 # Serialized AutoML joblib pipelines
│   └── remotion_app/           # Headless Remotion React video rendering app
├── Dockerfile.backend          # Root backend Docker build file
├── Dockerfile.frontend         # Root frontend Docker build file
├── start.sh                    # Linux / macOS 1-click startup automation
└── start.bat                   # Windows 1-click startup automation
```

---

## 🔧 Environment Configuration (`backend/.env`)

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://tarq:tarq@postgres:5432/tarq` |
| `TARQ_WORKSPACE_DIR` | Host path for persistent artifacts | `/path/to/TarQ/workspace` |
| `CREDENTIAL_ENCRYPTION_KEY`| AES-GCM key for encrypting SQL passwords | 32-byte Base64 key |
| `ANTHROPIC_API_KEY` | Anthropic Claude API Key (optional) | `sk-ant-...` |
| `OPENAI_API_KEY` | OpenAI GPT API Key (optional) | `sk-...` |
| `GOOGLE_API_KEY` | Google Gemini API Key (optional) | `AIzaSy...` |

---

## 🧪 Running Tests

```bash
cd backend
pytest tests/ -v
```

All core systems (sandbox isolation, state checkpointers, AutoML training loop, and dashboard specifications) include automated integration tests.