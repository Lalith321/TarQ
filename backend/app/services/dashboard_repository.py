from __future__ import annotations

from collections.abc import Callable
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.db import DashboardModel
from app.models.schemas import DashboardSpec


class DashboardRepository:
    """SQLAlchemy persistence adapter for dashboard specifications."""

    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self._session_factory = session_factory

    def save(self, spec: DashboardSpec) -> DashboardSpec:
        record = DashboardModel(
            id=spec.id,
            user_id=None,
            title=spec.title,
            spec=spec.model_dump(mode="json"),
        )
        with self._session_factory() as session:
            with session.begin():
                session.merge(record)
        return spec

    def get(self, dashboard_id: str) -> DashboardSpec | None:
        with self._session_factory() as session:
            record = session.get(DashboardModel, dashboard_id)
            return self._to_spec(record) if record else None

    def list(self) -> list[DashboardSpec]:
        with self._session_factory() as session:
            records = session.scalars(
                select(DashboardModel).order_by(DashboardModel.created_at, DashboardModel.id)
            ).all()
            return [self._to_spec(record) for record in records]

    def delete(self, dashboard_id: str) -> bool:
        with self._session_factory() as session:
            with session.begin():
                result = session.execute(
                    delete(DashboardModel).where(DashboardModel.id == dashboard_id)
                )
        return result.rowcount > 0

    @staticmethod
    def _to_spec(record: DashboardModel) -> DashboardSpec:
        return DashboardSpec.model_validate(record.spec)
