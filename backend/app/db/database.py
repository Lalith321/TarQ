"""
Not wired into any router yet — the routers currently use the in-memory
DashboardService. This exists so persistence is a one-line swap later:
replace `DashboardService._dashboards` (a dict) with SQLAlchemy-backed reads
and pass `SessionLocal` into it.

Uses SQLite by default (no server, no credentials) matching the existing
stack's habit of starting there; DATABASE_URL env var swaps to Postgres
without touching any calling code.
"""
import os

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./dashboard_platform.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
