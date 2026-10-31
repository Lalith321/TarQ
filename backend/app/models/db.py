from __future__ import annotations
import uuid
from typing import Any
from sqlalchemy import JSON, String, DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class DashboardModel(Base):
    __tablename__ = "dashboards"

    # Fast primary key index
    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    title: Mapped[str] = mapped_column(String, nullable=False)

    # Store the entire DashboardSpec (including all nested WidgetSpecs) here
    spec: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)

    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class SchemaConfigModel(Base):
    __tablename__ = "schema_configs"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False, index=True)
    source_type: Mapped[str] = mapped_column(String, nullable=False, index=True)
    status: Mapped[str] = mapped_column(String, nullable=False, index=True)
    owner: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    config: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)

    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class SchemaCredentialModel(Base):
    __tablename__ = "schema_credentials"

    schema_id: Mapped[str] = mapped_column(String, primary_key=True)
    encrypted_password: Mapped[str] = mapped_column(String, nullable=False)


class AgentFleetStateModel(Base):
    __tablename__ = "agent_fleet_state"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    state: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)