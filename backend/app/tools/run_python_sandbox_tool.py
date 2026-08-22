"""
Exposes the deep analyst's Sandbox as a standalone LangChain tool, so any
other agent in the codebase (not just DeepDataAnalystAgent) can run
sandboxed Python without pulling in the whole agent orchestrator.

Assumes this file sits alongside `backend/` (as in this project's layout);
adjust the sys.path bootstrap if you copy it elsewhere.
"""
import sys
from pathlib import Path

_BACKEND = Path(__file__).resolve().parent.parent / "backend"
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

import json
from typing import Annotated

from langchain_core.tools import tool

from app.agent.sandbox import Sandbox

# One process-wide sandbox per Python process this tool is imported into —
# not per-conversation. For per-session isolation (recommended once more
# than one user/agent shares a process), instantiate Sandbox() per session
# and bind it via a closure or a class-based tool instead of this module
# singleton. See LIMITATIONS.md.
_sandbox = Sandbox()


@tool
def run_python_sandbox(
    code: Annotated[str, (
        "Python to execute. pandas and numpy are pre-imported as pd/np. "
        "Variables persist across calls within this process. Blocked: os, sys, "
        "subprocess, socket, shutil, ctypes, multiprocessing, threading, "
        "importlib, and direct eval/exec/open calls — this is a denylist + "
        "CPU-time limit, not a hardened jail; don't run untrusted code through "
        "it expecting container-grade isolation."
    )],
) -> str:
    """Run Python in a stateful sandbox and get back stdout/stderr/error as
    JSON. Use this for any data exploration, computation, or transformation
    step instead of trying to reason about numeric results yourself — run
    the actual code and read the output."""
    result = _sandbox.run(code)
    return json.dumps({
        "ok": result.ok,
        "stdout": result.stdout,
        "stderr": result.stderr,
        "error": result.error,
        "variables": result.variables,
    })
