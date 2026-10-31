# TarQ Platform Documentation

Welcome to the comprehensive documentation suite for **TarQ** (Agentic Dashboard and Intelligence Platform).

To ensure clarity for different audiences, the documentation for this repository is strictly organized into separate, dedicated tracks:

---

## 📚 Documentation Tracks

```
TarQ Documentation
├── 1. README (Project Root)
│   └── Overview, Quickstart, System Requirements & Repository Navigation
├── 2. Functional Documentation (docs/functional/)
│   └── Business Capabilities, User Personas, Workflows & Feature Specifications
└── 3. Technical Documentation (docs/technical/)
    └── System Architecture, Multi-Agent Engine, APIs, Schemas & Engineering Deep Dive
```

---

### 1. [Root README](../../README.md)
* **Audience:** Developers, DevOps engineers, evaluators, and anyone setting up the repository.
* **Scope:** Platform overview, quick start using Docker or native environments, environment setup, repository layout, and operational commands.

### 2. [Functional Documentation](functional/functional_specification.md)
* **Audience:** Product managers, business analysts, data scientists, executives, and end-users.
* **Scope:**
  * **System Purpose & Vision:** High-level platform value proposition.
  * **User Personas & Use Cases:** Detailed role-based workflows for Executives, Data Analysts, ML Practitioners, and Operations teams.
  * **End-to-End User Journeys:** Step-by-step walkthroughs of common operations (conversational inquiry to dashboard, raw CSV to trained ML model, analytics artifact to animated video briefing).
  * **Feature Catalog:**
    * Conversational Agentic Copilot & Live Todo Task Tracker
    * Multi-Source Data Connectivity & Schema Explorer
    * Dynamic Agentic Dashboards & Rich Visualizations (7+ widget types, drilldowns, PDF export)
    * AutoML Studio (Hyperparameter tuning, leaderboard, interactive predictions)
    * Autonomous Motion Video & Voiceover Generation (Remotion + TTS)
    * Document Intelligence & Unstructured Knowledge Ingestion
    * Interactive 3D Earth Data Visualization
  * **Business Guardrails & Auditing:** Human-in-the-loop oversight, low-confidence flagging, and read-only protections.

### 3. [Technical Documentation](technical/technical_specification.md)
* **Audience:** Software engineers, systems architects, security reviewers, and technical contributors.
* **Scope:**
  * **System Architecture & Topology:** Full component interaction diagrams and runtime topologies.
  * **Multi-Agent Orchestration & LangGraph Engine:** Graph state machine (`GraphState`), `master_coordinator`, `data_analyst_node`, `narrator`, and PostgreSQL checkpointer.
  * **Secure Execution Sandbox:** Subprocess vs. Docker isolation, CPU rlimits, AST denylists, stateful session IPC daemon.
  * **Tool Ecosystem:** Input/output contracts for SQL execution, dashboard synthesis, Python execution, and video generation.
  * **AutoML Engine (`app/ml`):** Problem type inference, Scikit-learn pipelines, Optuna Bayesian optimization search spaces, and model registry serialization.
  * **Autonomous Video Rendering Pipeline:** Headless Remotion composition, React motion graphics, TTS voiceover audio alignment, and MP4 synthesis.
  * **Context Management & Artifact Vault:** Sliding token budgets, summarization strategies, and conversational vs. structured artifact separation.
  * **Data Persistence & Cryptographic Security:** Database schemas, AES-GCM credential encryption at rest, connection pooling, and statement timeouts.
  * **REST & WebSocket API Reference:** Exhaustive schema, parameter, and response documentation for all endpoints.
  * **Frontend Engineering:** React 18, TypeScript, Three.js WebGL globe with custom shaders and decals, Leaflet GIS, and Recharts.
  * **DevOps, Docker & Deployment:** Multi-stage Docker builds, network topologies, volume mounts, and environment configuration matrix.

---

## 🧭 Which Document Should You Read?

| If you want to... | Read this: |
| :--- | :--- |
| **Get TarQ running in 2 minutes** | [Root README](../../README.md) |
| **Understand what features TarQ provides and how end users interact with it** | [Functional Specification](functional/functional_specification.md) |
| **Inspect user personas, workflows, and business scenarios** | [Functional Specification](functional/functional_specification.md) |
| **Understand the LangGraph multi-agent architecture and state flow** | [Technical Specification](technical/technical_specification.md#2-multi-agent-orchestration--langgraph-state-machine) |
| **Learn how code sandbox security and Docker isolation works** | [Technical Specification](technical/technical_specification.md#3-execution-sandbox--code-isolation-engine) |
| **Review the REST & WebSocket API endpoints and contracts** | [Technical Specification](technical/technical_specification.md#9-comprehensive-api-reference) |
| **Understand how Remotion videos are programmatically created** | [Technical Specification](technical/technical_specification.md#6-autonomous-motion-video-rendering-pipeline) |
| **Understand credential encryption and data storage** | [Technical Specification](technical/technical_specification.md#8-database-persistence--cryptographic-security) |
| **Set up backend development tools or run unit tests** | [Backend README](../../backend/README.md) |
