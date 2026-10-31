from __future__ import annotations

import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile

from app.core.insight_extractor import DocumentInsightExtractor
from app.models.schemas import InsightBundle
from app.core.workspace_paths import workspace_dir

router = APIRouter(prefix="/documents", tags=["documents"])

_UPLOAD_DIR = workspace_dir() / "uploads" / "documents"
_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# In-memory cache of extraction results by upload id. Swap for a real table
# once persistence is needed.
_insight_cache: dict[str, InsightBundle] = {}

# No extract_fn wired in this build (no model credentials configured) — the
# extractor runs its heuristic fallback end-to-end. Inject a real LangChain
# callable here in production: DocumentInsightExtractor(extract_fn=my_llm_call)
_extractor = DocumentInsightExtractor(extract_fn=None)


@router.post("/upload", response_model=InsightBundle)
async def upload_document(file: UploadFile):
    """Accepts literally any file — pdf, docx, csv, txt, or a document with
    no recognizable structure at all — and returns whatever insight the
    extraction pipeline could pull out of it. Nothing here validates the
    file "looks like" a report first."""
    upload_id = uuid.uuid4().hex[:12]
    suffix = Path(file.filename or "").suffix
    dest = _UPLOAD_DIR / f"{upload_id}{suffix}"

    with dest.open("wb") as out:
        shutil.copyfileobj(file.file, out)

    bundle = _extractor.run(str(dest))
    bundle.source_file = file.filename or dest.name
    _insight_cache[upload_id] = bundle
    return bundle


@router.get("/{upload_id}/insights", response_model=InsightBundle)
def get_insights(upload_id: str):
    bundle = _insight_cache.get(upload_id)
    if bundle is None:
        raise HTTPException(404, f"no insights cached for upload '{upload_id}'")
    return bundle
