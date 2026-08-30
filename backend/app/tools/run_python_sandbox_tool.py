"""LangChain adapter for the shared sandbox backend interface."""

import json
from typing import Annotated

from langchain_core.tools import tool

from app.agent.sandbox import SandboxBackend


def create_run_python_sandbox_tool(sandbox: SandboxBackend):
    """Bind a stateful Python tool to a caller-owned sandbox backend.

    Owning the backend outside this adapter keeps agent sessions isolated and
    ensures every agent uses the same backend contract.
    """

    @tool
    def run_python_sandbox(
        code: Annotated[str, (
            "Python to execute in the current sandbox session. Variables persist "
            "between calls. Use the sandbox workspace for files."
        )],
    ) -> str:
        """Run stateful Python and return structured execution output."""
        result = sandbox.execute_session(code)
        return json.dumps({
            "ok": result.success,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "timed_out": result.timed_out,
            "files_created": result.files_created,
        })

    return run_python_sandbox
