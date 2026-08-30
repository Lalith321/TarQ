from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.db import Base
from app.models.schemas import DashboardSpec
from app.services.dashboard_service import DashboardService


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
