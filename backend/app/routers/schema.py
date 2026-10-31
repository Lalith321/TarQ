from __future__ import annotations

from urllib.parse import quote_plus

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError

from app.models.schemas import SchemaConfig
from app.services.dashboard_service import dashboard_service

router = APIRouter(prefix="/schemas", tags=["schema"])


class SQLConnectionRequest(BaseModel):
    dbType: str
    host: str
    port: str
    database: str
    username: str
    password: str
    ssl: bool = False


def create_sqlalchemy_engine(payload: SQLConnectionRequest):
    db_type = (payload.dbType or "").strip().lower()
    if db_type not in {"postgresql", "postgres", "pg"}:
        raise ValueError("Only PostgreSQL connections are supported for schema testing in this build.")

    username = quote_plus(payload.username.strip())
    password = quote_plus(payload.password)
    host = payload.host.strip()
    port = str(payload.port).strip() or "5432"
    database = payload.database.strip()
    sslmode = "require" if payload.ssl else "prefer"
    url = (
        f"postgresql+psycopg://{username}:{password}@{host}:{port}/{database}?sslmode={sslmode}"
    )
    return create_engine(url, pool_pre_ping=True, connect_args={"connect_timeout": 10})


@router.post("/test-connection")
def test_connection(payload: SQLConnectionRequest):
    try:
        engine = create_sqlalchemy_engine(payload)
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
            schemas = connection.execute(
                text(
                    """
                    SELECT schema_name
                    FROM information_schema.schemata
                    WHERE schema_name NOT IN ('pg_toast', 'pg_catalog', 'information_schema')
                    ORDER BY schema_name
                    """
                )
            ).scalars().all()
            tables = connection.execute(
                text(
                    """
                    SELECT table_schema || '.' || table_name
                    FROM information_schema.tables
                    WHERE table_schema NOT IN ('pg_toast', 'pg_catalog', 'information_schema')
                    ORDER BY table_schema, table_name
                    LIMIT 200
                    """
                )
            ).scalars().all()

        return {
            "success": True,
            "schemas": list(schemas),
            "tables": list(tables),
        }
    except (ValueError, SQLAlchemyError, OSError) as exc:
        return {"success": False, "error": str(exc), "schemas": [], "tables": []}


@router.get("/", response_model=list[SchemaConfig])
def list_schemas():
    return dashboard_service.list_schemas()


@router.post("/", response_model=SchemaConfig)
def create_schema(schema: SchemaConfig):
    password = schema.metadata.pop("password", None)
    created = dashboard_service.create_schema(schema)
    if password is not None:
        dashboard_service.set_schema_password(schema.id, str(password))
    return created


@router.get("/{schema_id}", response_model=SchemaConfig)
def get_schema(schema_id: str):
    schema = dashboard_service.get_schema(schema_id)
    if schema is None:
        raise HTTPException(404, f"schema '{schema_id}' not found")
    return schema


@router.patch("/{schema_id}", response_model=SchemaConfig)
def update_schema(schema_id: str, updates: dict):
    schema = dashboard_service.update_schema(schema_id, updates)
    if schema is None:
        raise HTTPException(404, f"schema '{schema_id}' not found")
    return schema


@router.delete("/{schema_id}", status_code=204)
def delete_schema(schema_id: str):
    if not dashboard_service.delete_schema(schema_id):
        raise HTTPException(404, f"schema '{schema_id}' not found")
