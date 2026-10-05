"""
Database engine, session factory, and schema initialization for the backend.
DashboardService receives SessionLocal by default and uses it through its
repository adapter; passing a different session factory makes it easy to test
or configure another database.

This is the user-managed workspace database: dashboards live here today,
and user-created artifacts such as saved ML models can live here later.
When Postgres is used, all ORM tables in this module are placed in the
``workspace`` schema, separate from LangGraph checkpoint tables.

The application requires one PostgreSQL ``DATABASE_URL``. Dashboard storage
uses its ``workspace`` schema; no alternate database or SQLite fallback is
supported.
"""
import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.schema import CreateSchema

from app.models.db import Base

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL must be set to a PostgreSQL connection URL")
if not DATABASE_URL.startswith("postgresql"):
    raise RuntimeError("DATABASE_URL must use the postgresql:// URL scheme")

_raw_engine = create_engine(DATABASE_URL)
WORKSPACE_SCHEMA = "workspace"

# schema_translate_map applies the workspace schema consistently to DDL and
# ORM queries without baking a Postgres-only schema into the model classes.
engine = _raw_engine.execution_options(schema_translate_map={None: WORKSPACE_SCHEMA})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db() -> None:
    with _raw_engine.begin() as connection:
        connection.execute(CreateSchema(WORKSPACE_SCHEMA, if_not_exists=True))
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
