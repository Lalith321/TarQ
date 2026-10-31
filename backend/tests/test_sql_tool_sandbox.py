import json

from sqlalchemy import create_engine

from app.agent.sandbox import SubprocessBackend
from app.tools.sql_tool import create_sql_tools


def test_sql_export_is_written_to_active_sandbox(tmp_path):
    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        connection.exec_driver_sql("CREATE TABLE sales (amount INTEGER)")
        connection.exec_driver_sql("INSERT INTO sales VALUES (10), (20)")

    sandbox = SubprocessBackend(workspace=str(tmp_path / "sandbox")).start()
    try:
        query_tool = create_sql_tools(
            engine=engine,
            sandbox_backend=sandbox,
            tool_name_prefix="test",
        )[0]

        result = json.loads(query_tool.invoke({"query": "SELECT amount FROM sales"}))

        assert result["status"] == "success"
        assert result["file_path"].startswith(sandbox.workspace_root)
        csv_result = sandbox.read_file(result["file_path"])
        assert csv_result.success
        assert csv_result.stdout.splitlines() == ["amount", "10", "20"]
    finally:
        sandbox.stop()
        engine.dispose()