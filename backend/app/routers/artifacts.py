from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from ..core.workspace_paths import workspace_dir

router = APIRouter(prefix="/artifacts", tags=["artifacts"])
ARTIFACT_DIR = workspace_dir() / "artifacts"


@router.get("/")
def list_artifacts() -> list[dict[str, object]]:
    manifest_path = ARTIFACT_DIR / "MANIFEST.json"
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []

    artifacts = []
    for filename, metadata in manifest.items():
        if Path(filename).name != filename:
            continue
        artifact_path = ARTIFACT_DIR / filename
        if not artifact_path.is_file():
            continue
        artifacts.append({
            "id": filename,
            "name": filename,
            "type": metadata.get("type", "application/octet-stream"),
            "size": artifact_path.stat().st_size,
            "url": f"/artifacts/{filename}",
        })
    return artifacts


@router.get("/{filename}")
def download_artifact(filename: str) -> FileResponse:
    if Path(filename).name != filename:
        raise HTTPException(status_code=400, detail="Invalid artifact filename")
    path = ARTIFACT_DIR / filename
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Artifact not found")
    return FileResponse(path, filename=filename)