import os
import json
import uuid
import pandas as pd
from typing import Optional, Type, Dict, Any
from pydantic import BaseModel, Field

from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from langchain_community.utilities import SQLDatabase
from langchain_community.tools.sql_database.tool import (
    InfoSQLDatabaseTool,
    ListSQLDatabaseTool,
    BaseSQLDatabaseTool,
)
from langchain_core.tools import BaseTool
from langchain_core.callbacks import CallbackManagerForToolRun


# ---------------------------------------------------------------------------
# Pydantic Input Schema for the Custom SQL Tool
# ---------------------------------------------------------------------------
class CustomQuerySQLInput(BaseModel):
    query: str = Field(
        ..., 
        description="A detailed and correct SQL query to run against the database."
    )
    description: Optional[str] = Field(
        default="SQL query result dataset",
        description="A short human-readable summary of what this query extracts (e.g. 'Q3 2026 revenue breakdown')."
    )


# ---------------------------------------------------------------------------
# Custom Sandbox-Exporting SQL Tool
# ---------------------------------------------------------------------------
class SandboxExportQuerySQLTool(BaseSQLDatabaseTool, BaseTool):
    """
    Executes SQL queries safely, exports full result sets directly to CSV 
    in the sandbox workspace, updates MANIFEST.json, and returns structured 
    metadata preview to the LLM to conserve context window tokens.
    """
    name: str = "query_sql_database_tool"
    description: str = (
        "Execute SELECT queries to retrieve financial data. Results are automatically "
        "saved to a CSV file in the sandbox scratch directory for processing. Returns file path and preview metadata."
    )
    args_schema: Type[BaseModel] = CustomQuerySQLInput
    sandbox_dir: str = "sandbox_data"

    def _run(
        self, 
        query: str, 
        description: str = "SQL query result dataset",
        run_manager: Optional[CallbackManagerForToolRun] = None
    ) -> str:
        try:
            # 1. Execute SQL query directly using underlying SQLAlchemy engine
            with self.db._engine.connect() as connection:
                df = pd.read_sql_query(query, connection)

            if df.empty:
                return json.dumps({
                    "status": "success",
                    "message": "Query executed successfully but returned 0 rows.",
                    "row_count": 0,
                    "columns": list(df.columns)
                })

            # 2. Ensure destination sandbox directory exists
            os.makedirs(self.sandbox_dir, exist_ok=True)

            # 3. Create unique file path & save raw CSV
            file_id = f"query_{uuid.uuid4().hex[:8]}"
            filename = f"{file_id}.csv"
            file_path = os.path.join(self.sandbox_dir, filename)
            df.to_csv(file_path, index=False)

            # 4. Read or initialize MANIFEST.json for sandbox tracking
            manifest_path = os.path.join(self.sandbox_dir, "MANIFEST.json")
            manifest_data = {}
            if os.path.exists(manifest_path):
                try:
                    with open(manifest_path, "r", encoding="utf-8") as f:
                        manifest_data = json.load(f)
                except Exception:
                    manifest_data = {}

            # 5. Register entry in manifest
            manifest_data[filename] = {
                "source_query": query,
                "description": description,
                "row_count": len(df),
                "columns": list(df.columns),
                "created_at": pd.Timestamp.now().isoformat()
            }
            with open(manifest_path, "w", encoding="utf-8") as f:
                json.dump(manifest_data, f, indent=2)

            # 6. Generate lightweight preview payload for LLM Context Window
            preview_rows = df.head(3).to_dict(orient="records")
            metadata = {
                "status": "success",
                "file_path": file_path,
                "filename": filename,
                "description": description,
                "row_count": len(df),
                "columns": list(df.columns),
                "head_preview": preview_rows,
                "instructions": (
                    f"Full dataset written to sandbox file path: '{file_path}'. "
                    "Use sandbox Python execution tools (e.g., pandas) to inspect or analyze the full dataset."
                )
            }
            return json.dumps(metadata, indent=2)

        except Exception as e:
            return json.dumps({
                "status": "error",
                "error_details": str(e),
                "failed_query": query
            })


# ---------------------------------------------------------------------------
# Factory Function Replacement
# ---------------------------------------------------------------------------
def create_sql_tools(db_path: str, sandbox_dir: str = "sandbox_data"):
    """
    Create SQL tools for given database path with CSV output redirected to sandbox.
    """
    engine = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    import atexit
    atexit.register(engine.dispose)
    
    db = SQLDatabase(engine)
    
    # Custom Sandbox Middleware SQL Tool
    query_sql_database_tool = SandboxExportQuerySQLTool(
        db=db,
        handle_tool_error=True,
        handle_validation_error=True,
        sandbox_dir=sandbox_dir,
    )
    
    list_sql_database_tool = ListSQLDatabaseTool(
        db=db, 
        handle_tool_error=True, 
        handle_validation_error=True, 
        name="list_sql_database_tool",
        description="List all available tables in the database. Use this FIRST to see what financial data tables exist."
    )
    
    schema_sql_database_tool = InfoSQLDatabaseTool(
        db=db, 
        handle_tool_error=True, 
        handle_validation_error=True, 
        name="schema_sql_database_tool",
        description="Get detailed schema information for specific tables. Use this to understand column names and data types."
    )
    
    return [query_sql_database_tool, list_sql_database_tool, schema_sql_database_tool]