from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.db import Base, SchemaCredentialModel
from app.models.schemas import (
    DashboardSpec,
    SchemaConfig,
    SchemaStatus,
    SchemaSourceType,
    WidgetPosition,
    WidgetSpec,
    WidgetType,
)
from app.services.dashboard_service import DashboardService


def test_schema_config_can_be_persisted_and_loaded(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'schemas.db'}")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, autoflush=False)

    schema = SchemaConfig(
        id="schema_1",
        name="sales_remote",
        source_type=SchemaSourceType.REMOTE_SQL,
        status=SchemaStatus.CONNECTED,
        owner="demo-user",
        metadata={"host": "db.example.com", "database": "sales"},
        tables=[
            {
                "name": "orders",
                "columns": [
                    {"name": "id", "data_type": "int", "selected": True},
                    {"name": "customer_id", "data_type": "int", "selected": True},
                ],
            }
        ],
    )

    service = DashboardService(session_factory)
    stored = service.create_schema(schema)
    loaded = service.get_schema("schema_1")

    assert stored.id == "schema_1"
    assert loaded is not None
    assert loaded.name == "sales_remote"
    assert loaded.tables[0]["name"] == "orders"
    assert loaded.tables[0]["columns"][0]["selected"] is True


def test_schema_credentials_persist_encrypted_across_service_instances(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'credentials.db'}")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, autoflush=False)

    monkeypatch.setenv("CREDENTIAL_ENCRYPTION_KEY", "test-only-stable-secret")
    first_service = DashboardService(session_factory)
    first_service.set_schema_password("schema_1", "db-password")
    second_service = DashboardService(session_factory)

    assert second_service.get_schema_password("schema_1") == "db-password"

    with session_factory() as session:
        stored = session.get(SchemaCredentialModel, "schema_1")
    assert stored is not None
    assert stored.encrypted_password != "db-password"


def test_dashboard_service_persists_across_instances(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'dashboards.db'}")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, autoflush=False)

    spec = DashboardSpec(id="saved", title="Saved dashboard")
    DashboardService(session_factory).create(spec)

    loaded = DashboardService(session_factory).get(spec.id)

    assert loaded == spec


def test_dashboard_service_can_keep_in_memory_mode():
    service = DashboardService(None)
    spec = DashboardSpec(id="memory", title="Memory dashboard")

    service.create(spec)

    assert service.get(spec.id) == spec


def test_live_query_uses_saved_source_and_bound_parameters(tmp_path, monkeypatch):
    workspace_engine = create_engine(f"sqlite:///{tmp_path / 'workspace.db'}")
    Base.metadata.create_all(workspace_engine)
    session_factory = sessionmaker(bind=workspace_engine, autoflush=False)
    service = DashboardService(session_factory)
    monkeypatch.setenv("CREDENTIAL_ENCRYPTION_KEY", "test-only-stable-secret")
    service.create_schema(
        SchemaConfig(
            id="schema_sales",
            name="Sales",
            source_type=SchemaSourceType.REMOTE_SQL,
            status=SchemaStatus.CONNECTED,
            metadata={
                "dbType": "PostgreSQL",
                "host": "db.example.test",
                "database": "sales",
                "username": "readonly",
            },
        )
    )
    service.set_schema_password("schema_sales", "secret")

    source_path = tmp_path / "source.db"
    source_engine = create_engine(f"sqlite:///{source_path}")
    with source_engine.begin() as connection:
        connection.exec_driver_sql(
            "CREATE TABLE orders (region TEXT, revenue INTEGER)"
        )
        connection.exec_driver_sql(
            "INSERT INTO orders VALUES ('West', 120), ('East', 80)"
        )
    source_engine.dispose()

    monkeypatch.setattr(
        service,
        "_create_source_engine",
        lambda schema, password: create_engine(f"sqlite:///{source_path}"),
    )

    rows = service._execute_readonly(
        "schema_sales",
        "SELECT region, revenue FROM orders WHERE revenue >= :minimum",
        {"minimum": 100},
    )

    assert rows == [{"region": "West", "revenue": 120}]


def test_live_query_rejects_writes_and_multiple_statements():
    assert DashboardService._has_multiple_statements("SELECT 1; SELECT 2")
    assert not DashboardService._has_multiple_statements("SELECT ';' AS value;")

    for query in ("UPDATE orders SET revenue = 0", "SELECT 1; DELETE FROM orders"):
        try:
            DashboardService._validate_read_query(query)
        except ValueError:
            continue
        raise AssertionError(f"unsafe query was accepted: {query}")


def test_live_query_results_are_not_persisted(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'dashboard_live.db'}")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, autoflush=False)
    service = DashboardService(session_factory)
    spec = DashboardSpec(
        id="live",
        title="Live data",
        widgets=[
            WidgetSpec(
                id="revenue",
                type=WidgetType.STAT,
                title="Revenue",
                data=[{"revenue": 120}],
                sql_connection="schema_sales",
                sql_query="SELECT SUM(revenue) AS revenue FROM orders",
                position=WidgetPosition(x=0, y=0, w=3, h=2),
            )
        ],
    )

    service.create(spec)

    saved = service.get("live")
    assert saved is not None
    assert saved.widgets[0].data == []


def test_dashboard_service_updates_and_deletes_persisted_dashboard(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'dashboards.db'}")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, autoflush=False)
    service = DashboardService(session_factory)
    service.create(DashboardSpec(id="saved", title="Before"))

    updated = service.update("saved", {"title": "After"})

    assert updated is not None
    assert updated.title == "After"
    assert service.delete("saved") is True
    assert service.get("saved") is None


def test_dashboard_service_update_validates_widget_dicts(tmp_path):
    service = DashboardService(None)
    service.create(DashboardSpec(id="widgets", title="Dashboard"))
    widget = WidgetSpec(
        id="revenue",
        type=WidgetType.STAT,
        title="Revenue",
        data=[{"revenue": 120}],
        sql_connection="schema_sales",
        sql_query="SELECT SUM(revenue) AS revenue FROM orders",
        position=WidgetPosition(x=0, y=0, w=3, h=2),
    )

    updated = service.update("widgets", {"widgets": [widget.model_dump(mode="json")]})

    assert updated is not None
    assert isinstance(updated.widgets[0], WidgetSpec)
    assert updated.widgets[0].data == []
