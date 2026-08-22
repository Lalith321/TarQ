from __future__ import annotations

import shutil
import tempfile
from pathlib import Path

import pandas as pd
from fastapi import APIRouter, HTTPException, UploadFile, Form

from app.ml.registry import model_registry
from app.ml.service import train_and_register

router = APIRouter(prefix="/ml", tags=["ml"])

_UPLOAD_DIR = Path(tempfile.gettempdir()) / "dashboard_platform_ml_uploads"
_UPLOAD_DIR.mkdir(exist_ok=True)


@router.post("/train")
async def train(
    file: UploadFile,
    target: str = Form(...),
    task: str | None = Form(None),
    n_trials: int = Form(20),
):
    """Upload a CSV, name the target column, get back a trained model id
    plus the full Optuna leaderboard. No LLM call happens in this path
    unless a real explain_fn is wired into train_and_register (none is, by
    default — see ml/explain.py)."""
    dest = _UPLOAD_DIR / file.filename
    with dest.open("wb") as out:
        shutil.copyfileobj(file.file, out)

    try:
        df = pd.read_csv(dest)
        result = train_and_register(df, target=target, task=task, n_trials=n_trials)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    return result


@router.get("/models")
def list_models():
    return [
        {"model_id": r.model_id, "best_model_name": r.report.best_model_name,
         "best_score": r.report.best_score, "task": r.report.task, "target": r.report.target}
        for r in model_registry.list()
    ]


@router.post("/models/{model_id}/predict")
def predict(model_id: str, rows: list[dict]):
    try:
        return {"predictions": model_registry.predict(model_id, rows)}
    except KeyError as exc:
        raise HTTPException(404, str(exc))
    except Exception as exc:
        raise HTTPException(400, str(exc))
