from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_stream_content_normalizes_text_blocks():
    from app.routers.chat import _text_from_content

    assert _text_from_content("hello") == "hello"
    assert _text_from_content(["hello ", {"type": "text", "text": "world"}]) == "hello world"
    assert _text_from_content([{"type": "image", "data": "ignored"}]) == ""


def test_analyst_artifact_extraction_accepts_current_tool_names():
    import json

    from langchain_core.messages import ToolMessage

    from app.agent.data_analyst import _extract_artifacts_from_tool_messages

    messages = [
        ToolMessage(
            content=json.dumps({"status": "success", "filename": "query.csv", "file_path": "/workspace/query.csv"}),
            name="source_1_public_1_query_sql_database_tool",
            tool_call_id="sql-call",
        ),
        ToolMessage(
            content="Dashboard ready",
            name="dashboard_tool",
            tool_call_id="dashboard-call",
            artifact={"id": "dash-1", "artifact_path": "/tmp/dashboard.json"},
        ),
    ]

    assert _extract_artifacts_from_tool_messages(messages) == {
        "query.csv": "/workspace/query.csv",
        "dashboard_dash-1": "/tmp/dashboard.json",
    }


def test_coordinator_receives_attached_sources_before_planning(monkeypatch):
    from types import SimpleNamespace

    from langchain_core.messages import AIMessage, HumanMessage
    from langgraph.graph import END

    from app.core import tarq_coord

    captured = {}

    class FakeCoordinator:
        def invoke(self, payload):
            captured["messages"] = payload["messages"]
            return {
                "messages": [AIMessage(content={"todo": [], "next": "end", "note": "Done."})]
            }

    def fake_create_agent(*, model, system_prompt, response_format):
        captured["system_prompt"] = system_prompt
        return FakeCoordinator()

    monkeypatch.setattr(tarq_coord, "create_agent", fake_create_agent)
    monkeypatch.setattr(tarq_coord, "create_chat_model", lambda settings: object())
    monkeypatch.setattr(
        tarq_coord,
        "get_agent_config",
        lambda agent, fleet_id: SimpleNamespace(enabled=True, instructions=""),
    )

    tarq_coord.master_coordinator(
        {
            "messages": [HumanMessage(content="Compare revenue for these companies")],
            "selected_sources": [
                {"schema_id": "finance-db", "tables": ["public.company_financials"]}
            ],
            "todo": [],
        },
        {"configurable": {}},
    )

    system_context = captured["messages"][-1][1]
    assert "finance-db" in system_context
    assert "company_financials" in system_context
    assert "before reporting that data is missing or" in captured["system_prompt"]


def test_narrator_handoff_includes_user_request_and_analyst_report():
    from langchain_core.messages import AIMessage, HumanMessage

    from app.agent.narrator import _analyst_handoff

    handoff = _analyst_handoff([
        HumanMessage(content="Create a comparison video"),
        AIMessage(content="Revenue chart created", name="Data Analyst"),
    ])

    assert "Create a comparison video" in handoff
    assert "Revenue chart created" in handoff


def test_narrator_lists_registered_artifacts_without_sandbox_directory():
    import json

    from app.agent.sandbox import ExecutionResult
    from app.tools.narrator_tool import create_narrator_tools

    class MissingArtifactSandbox:
        def read_file(self, path):
            return ExecutionResult("", "Not found", 1)

        def list_dir(self, path):
            raise AssertionError("registered artifacts should not require a directory listing")

    artifact_registry = {"dashboard_dash-1": "/tmp/dashboard.json"}
    tools = create_narrator_tools(
        backend=MissingArtifactSandbox(),
        artifact_registry=artifact_registry,
    )

    assert json.loads(tools[0].invoke({}))["analysis_artifacts"] == artifact_registry


def test_quick_dashboard_route_exists():
    response = client.post("/agent/quick-dashboard", json={"prompt": "Revenue by region"})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["id"].startswith("quick_")
    assert body["title"]


def test_dashboard_chat_route_exists():
    response = client.post(
        "/agent/dashboard-chat",
        json={"sessionId": "s1", "message": "Build a chart", "context": {"dashboardId": "demo"}},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert "reply" in body


def test_multi_line_widget_type_accepts_multiple_y_fields():
    from app.routers.agent import _normalise_widget

    widget = _normalise_widget(
        {
            "type": "multi_line",
            "title": "Revenue by region",
            "data": [{"month": "Jan", "north": 10, "south": 12}],
            "x_field": "month",
            "y_field": ["north", "south"],
        },
        0,
    )

    assert widget["type"] == "multi_line"
    assert widget["y_field"] == ["north", "south"]


def test_agent_configs_route_is_mounted_and_mutable():
    initial = client.get("/api/agents/configs")
    assert initial.status_code == 200, initial.text
    configs = initial.json()
    assert {"coordinator", "analyst", "narrator"}.issubset(configs)

    configs["analyst"]["enabled"] = False
    updated = client.put("/api/agents/configs", json=configs)
    assert updated.status_code == 200, updated.text
    assert updated.json()["analyst"]["enabled"] is False

    reset = client.post("/api/agents/configs/reset")
    assert reset.status_code == 200, reset.text
    assert reset.json()["analyst"]["enabled"] is True


def test_agent_fleet_can_be_created_renamed_and_activated():
    from app.routers.agent_configs import get_agent_config

    default_fleet = next(
        fleet for fleet in client.get("/api/agents/fleets").json()["fleets"]
        if fleet["id"] == "default"
    )
    created = client.post("/api/agents/fleets", json={"name": "Forecasting Team"})
    assert created.status_code == 200, created.text
    fleet = created.json()["fleet"]
    assert fleet["name"] == "Forecasting Team"
    assert created.json()["activeFleetId"] == "default"

    fleet["configs"]["analyst"]["instructions"] = "Focus on forecasting evidence."
    updated = client.put(
        f"/api/agents/fleets/{fleet['id']}",
        json={"name": "Forecasting Research Team", "configs": fleet["configs"]},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["name"] == "Forecasting Research Team"
    assert get_agent_config("analyst", fleet["id"]).instructions == "Focus on forecasting evidence."

    activated = client.post(f"/api/agents/fleets/{fleet['id']}/activate")
    assert activated.status_code == 200, activated.text
    active_configs = client.get("/api/agents/configs").json()
    assert active_configs["analyst"]["instructions"] == "Focus on forecasting evidence."
    assert client.post("/api/agents/fleets/default/activate").status_code == 200
    assert client.get("/api/agents/configs").json() == default_fleet["configs"]


def test_active_agent_fleet_can_be_deleted():
    created = client.post("/api/agents/fleets", json={"name": "Disposable Team"})
    assert created.status_code == 200, created.text
    fleet_id = created.json()["fleet"]["id"]
    assert client.post(f"/api/agents/fleets/{fleet_id}/activate").status_code == 200

    deleted = client.delete(f"/api/agents/fleets/{fleet_id}")
    assert deleted.status_code == 200, deleted.text
    body = deleted.json()
    assert fleet_id not in {fleet["id"] for fleet in body["fleets"]}
    assert body["activeFleetId"] in {fleet["id"] for fleet in body["fleets"]}
    assert client.get("/api/agents/configs").status_code == 200


def test_schema_test_connection_rejects_bad_credentials():
    response = client.post(
        "/schemas/test-connection",
        json={
            "dbType": "PostgreSQL",
            "host": "localhost",
            "port": "5432",
            "database": "wrong_db",
            "username": "wrong_user",
            "password": "wrong_password",
            "ssl": False,
        },
    )
    assert response.status_code in {400, 500}, response.text
    body = response.json()
    assert body.get("success") is False


def test_schema_test_connection_accepts_valid_payload(monkeypatch):
    class FakeResult:
        def __iter__(self):
            return iter([])

    class FakeCursor:
        def __init__(self):
            self._rows = [("public",), ("analytics",)]

        def fetchall(self):
            return self._rows

    class FakeConnection:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def execute(self, statement):
            return FakeResult()

        def cursor(self):
            return FakeCursor()

        def close(self):
            pass

    class FakeEngine:
        def connect(self):
            return FakeConnection()

        def dispose(self):
            pass

    monkeypatch.setattr("app.routers.schema.create_sqlalchemy_engine", lambda payload: FakeEngine())

    response = client.post(
        "/schemas/test-connection",
        json={
            "dbType": "PostgreSQL",
            "host": "localhost",
            "port": "5432",
            "database": "app_db",
            "username": "app_user",
            "password": "secure_password",
            "ssl": False,
        },
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["success"] is True
    assert "public" in body["schemas"]
    assert "analytics" in body["schemas"]
