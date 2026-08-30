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