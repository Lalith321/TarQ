import os
from pathlib import Path


_REPOSITORY_WORKSPACE = Path(__file__).resolve().parents[3] / "workspace"


def workspace_dir() -> Path:
    """Return the workspace path visible to the running application."""
    return Path(os.environ.get("TARQ_WORKSPACE_DIR", _REPOSITORY_WORKSPACE)).resolve()


def workspace_host_dir() -> Path:
    """Return the same workspace path as seen by the Docker daemon host."""
    return Path(os.environ.get("TARQ_WORKSPACE_HOST_PATH", workspace_dir())).resolve()