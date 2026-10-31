from __future__ import annotations

import json
import mimetypes
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from ..core.workspace_paths import workspace_dir

router = APIRouter(prefix="/artifacts", tags=["artifacts"])
ARTIFACT_DIR = workspace_dir() / "artifacts"
INPUT_DIR = workspace_dir() / "dashboard_inputs"

_MIME_OVERRIDES: dict[str, str] = {
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pdf": "application/pdf",
    ".csv": "text/csv",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".json": "application/json",
}

# Known widget-ID signatures for legacy artifacts created before dashboard_id tagging
_LEGACY_WIDGET_SIGNATURES: dict[str, set[str]] = {
    "corporate_analysis_summary.mp4": {"revenue_comparison_chart", "sector_impact_table"},
    "reliance_adani_revenue_analysis.mp4": {
        "net_revenue_comparison",
        "sectors_of_operation",
        "impact_on_sectors",
        "summary_of_findings",
        "net_revenue_bar_chart",
        "total_revenue_trend",
    },
}


def infer_artifact_mime(filename: str) -> str:
    ext = Path(filename).suffix.lower()
    if ext in _MIME_OVERRIDES:
        return _MIME_OVERRIDES[ext]
    guessed, _ = mimetypes.guess_type(filename)
    return guessed or "application/octet-stream"


def _read_manifest(manifest_path: Path) -> dict[str, dict[str, Any]]:
    try:
        data = json.loads(manifest_path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def _write_manifest(manifest_path: Path, manifest: dict[str, dict[str, Any]]) -> None:
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")


def _reconcile_legacy_manifest_entries(
    manifest_path: Path, manifest: dict[str, dict[str, Any]]
) -> dict[str, dict[str, Any]]:
    """Map legacy manifest entries (missing dashboard_id) to their owning dashboard if identifiable."""
    unmapped = [
        fname
        for fname, meta in manifest.items()
        if isinstance(meta, dict) and not meta.get("dashboard_id")
    ]
    if not unmapped:
        return manifest

    try:
        from ..services.dashboard_service import dashboard_service

        dashboards = dashboard_service.list()
    except Exception:
        return manifest

    if not dashboards:
        return manifest

    changed = False
    for fname in unmapped:
        meta = manifest.get(fname)
        if not isinstance(meta, dict):
            continue

        # 1. Check explicit widget_ids recorded on metadata
        recorded_widgets = set(meta.get("widget_ids") or [])
        sig_widgets = _LEGACY_WIDGET_SIGNATURES.get(fname, set()) | recorded_widgets

        matched_id: str | None = None
        if sig_widgets:
            for dash in dashboards:
                dash_widget_ids = {w.id for w in (dash.widgets or [])}
                if dash_widget_ids & sig_widgets:
                    matched_id = dash.id
                    break

        # 2. Check filename prefix convention: <dashboard_id>_<rest>
        if not matched_id:
            for dash in dashboards:
                if fname.startswith(f"{dash.id}_"):
                    matched_id = dash.id
                    break

        if matched_id:
            meta["dashboard_id"] = matched_id
            changed = True

    if changed:
        try:
            _write_manifest(manifest_path, manifest)
        except OSError:
            pass
    return manifest


def register_artifact(
    filename: str,
    *,
    dashboard_id: str | None = None,
    artifact_type: str | None = None,
    display_name: str | None = None,
    extra_metadata: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    """Register or update an artifact in ARTIFACT_DIR/MANIFEST.json with proper dashboard mapping."""
    safe_name = Path(filename).name
    if safe_name != filename or not safe_name:
        return None
    artifact_path = ARTIFACT_DIR / safe_name
    if not artifact_path.is_file():
        return None

    manifest_path = ARTIFACT_DIR / "MANIFEST.json"
    manifest = _read_manifest(manifest_path)
    existing = manifest.get(safe_name) if isinstance(manifest.get(safe_name), dict) else {}

    resolved_dashboard_id = dashboard_id or existing.get("dashboard_id")
    resolved_display_name = display_name or existing.get("name")
    if not resolved_display_name:
        if resolved_dashboard_id and safe_name.startswith(f"{resolved_dashboard_id}_"):
            resolved_display_name = safe_name[len(resolved_dashboard_id) + 1 :]
        else:
            resolved_display_name = safe_name

    entry: dict[str, Any] = {
        **existing,
        "type": artifact_type or existing.get("type") or infer_artifact_mime(safe_name),
        "path": str(artifact_path),
        "size": artifact_path.stat().st_size,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if resolved_display_name and resolved_display_name != safe_name:
        entry["name"] = resolved_display_name
    if resolved_dashboard_id:
        entry["dashboard_id"] = resolved_dashboard_id
    if extra_metadata:
        entry.update(extra_metadata)

    manifest[safe_name] = entry
    _write_manifest(manifest_path, manifest)
    return entry


@router.get("/")
def list_artifacts(dashboard_id: str | None = None) -> list[dict[str, object]]:
    manifest_path = ARTIFACT_DIR / "MANIFEST.json"
    manifest = _read_manifest(manifest_path)
    if not manifest:
        return []

    if dashboard_id is not None:
        manifest = _reconcile_legacy_manifest_entries(manifest_path, manifest)

    artifacts: list[dict[str, object]] = []
    for filename, metadata in manifest.items():
        if Path(filename).name != filename or not isinstance(metadata, dict):
            continue
        if dashboard_id is not None and metadata.get("dashboard_id") != dashboard_id:
            continue
        artifact_path = ARTIFACT_DIR / filename
        if not artifact_path.is_file():
            continue
        display_name = metadata.get("name") or filename
        item: dict[str, object] = {
            "id": filename,
            "name": display_name,
            "type": metadata.get("type", infer_artifact_mime(filename)),
            "size": artifact_path.stat().st_size,
            "url": f"/artifacts/{filename}",
        }
        if "dashboard_id" in metadata:
            item["dashboard_id"] = metadata["dashboard_id"]
        artifacts.append(item)
    return artifacts


@router.get("/inputs")
def list_dashboard_inputs(dashboard_id: str = Query(...)) -> list[dict[str, object]]:
    manifest_path = INPUT_DIR / "MANIFEST.json"
    manifest = _read_manifest(manifest_path)
    items: list[dict[str, object]] = []
    for input_id, meta in manifest.items():
        if not isinstance(meta, dict) or meta.get("dashboard_id") != dashboard_id:
            continue
        stored_name = str(meta.get("stored_name") or "")
        if not stored_name or Path(stored_name).name != stored_name:
            continue
        file_path = INPUT_DIR / stored_name
        if not file_path.is_file():
            continue
        items.append({
            "id": input_id,
            "name": meta.get("name", stored_name),
            "type": meta.get("type", "FILE"),
            "size": meta.get("size_label", f"{max(1, file_path.stat().st_size // 1024)} KB"),
            "size_bytes": file_path.stat().st_size,
            "dashboard_id": dashboard_id,
            "url": f"/artifacts/inputs/file/{stored_name}",
            "uploaded_at": meta.get("uploaded_at", ""),
        })
    return items


@router.post("/inputs")
async def upload_dashboard_input(
    dashboard_id: str = Form(...),
    file: UploadFile = File(...),
) -> dict[str, object]:
    raw_name = Path(file.filename or "upload.bin").name
    input_id = f"in_{uuid.uuid4().hex[:10]}"
    stored_name = f"{dashboard_id}_{input_id}_{raw_name}"
    INPUT_DIR.mkdir(parents=True, exist_ok=True)
    dest = INPUT_DIR / stored_name
    with dest.open("wb") as out:
        shutil.copyfileobj(file.file, out)

    size_bytes = dest.stat().st_size
    size_label = (
        f"{size_bytes / 1_048_576:.1f} MB"
        if size_bytes > 1_048_576
        else f"{max(1, round(size_bytes / 1024))} KB"
    )
    ext_label = Path(raw_name).suffix.lstrip(".").upper() or "FILE"
    now_iso = datetime.now(timezone.utc).isoformat()

    manifest_path = INPUT_DIR / "MANIFEST.json"
    manifest = _read_manifest(manifest_path)
    manifest[input_id] = {
        "id": input_id,
        "name": raw_name,
        "stored_name": stored_name,
        "type": ext_label,
        "mime_type": file.content_type or infer_artifact_mime(raw_name),
        "size_bytes": size_bytes,
        "size_label": size_label,
        "dashboard_id": dashboard_id,
        "uploaded_at": now_iso,
    }
    _write_manifest(manifest_path, manifest)

    return {
        "id": input_id,
        "name": raw_name,
        "type": ext_label,
        "size": size_label,
        "size_bytes": size_bytes,
        "dashboard_id": dashboard_id,
        "url": f"/artifacts/inputs/file/{stored_name}",
        "uploaded_at": now_iso,
    }


@router.get("/inputs/file/{stored_name}")
def download_dashboard_input(stored_name: str) -> FileResponse:
    if Path(stored_name).name != stored_name:
        raise HTTPException(status_code=400, detail="Invalid input filename")
    path = INPUT_DIR / stored_name
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Input file not found")
    return FileResponse(path, filename=stored_name)


@router.delete("/inputs/{input_id}")
def delete_dashboard_input(input_id: str, dashboard_id: str | None = None) -> dict[str, object]:
    manifest_path = INPUT_DIR / "MANIFEST.json"
    manifest = _read_manifest(manifest_path)
    meta = manifest.get(input_id)
    if not isinstance(meta, dict):
        raise HTTPException(status_code=404, detail="Input not found")
    if dashboard_id is not None and meta.get("dashboard_id") != dashboard_id:
        raise HTTPException(status_code=404, detail="Input not found for this dashboard")
    stored_name = str(meta.get("stored_name") or "")
    manifest.pop(input_id, None)
    _write_manifest(manifest_path, manifest)
    if stored_name and Path(stored_name).name == stored_name:
        file_path = INPUT_DIR / stored_name
        if file_path.is_file():
            try:
                file_path.unlink()
            except OSError:
                pass
    return {"deleted": True, "id": input_id}


@router.delete("/{filename}")
def delete_artifact(filename: str, dashboard_id: str | None = None) -> dict[str, object]:
    if Path(filename).name != filename:
        raise HTTPException(status_code=400, detail="Invalid artifact filename")
    manifest_path = ARTIFACT_DIR / "MANIFEST.json"
    manifest = _read_manifest(manifest_path)
    meta = manifest.get(filename)
    if not isinstance(meta, dict):
        raise HTTPException(status_code=404, detail="Artifact not found")
    if dashboard_id is not None and meta.get("dashboard_id") != dashboard_id:
        raise HTTPException(status_code=404, detail="Artifact not found for this dashboard")
    manifest.pop(filename, None)
    _write_manifest(manifest_path, manifest)
    file_path = ARTIFACT_DIR / filename
    if file_path.is_file():
        try:
            file_path.unlink()
        except OSError:
            pass
    return {"deleted": True, "id": filename}


@router.get("/{filename}")
def download_artifact(filename: str) -> FileResponse:
    if Path(filename).name != filename:
        raise HTTPException(status_code=400, detail="Invalid artifact filename")
    path = ARTIFACT_DIR / filename
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Artifact not found")
    manifest = _read_manifest(ARTIFACT_DIR / "MANIFEST.json")
    meta = manifest.get(filename) if isinstance(manifest.get(filename), dict) else {}
    download_name = str(meta.get("name") or filename)
    media_type = str(meta.get("type") or infer_artifact_mime(filename))
    return FileResponse(path, filename=download_name, media_type=media_type)