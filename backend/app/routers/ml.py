from __future__ import annotations

import io
import shutil
from pathlib import Path
from typing import Any, Dict, List, Optional

import joblib
import pandas as pd
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel

from app.core.workspace_paths import workspace_dir
from app.ml.batch_predict import run_batch_prediction
from app.ml.explainability import explain_sample_prediction
from app.ml.registry import model_registry
from app.ml.service import train_and_register
from app.ml.timeseries import train_timeseries_model, ts_store

router = APIRouter(prefix="/ml", tags=["ml"])

_UPLOAD_DIR = workspace_dir() / "uploads" / "ml"
_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


class ExplainRequest(BaseModel):
    row: Dict[str, Any]


class TimeSeriesTrainPayload(BaseModel):
    target_column: str
    architecture: str = "lstm"
    lookback: int = 24
    horizon: int = 6
    scaler: str = "standard"
    epochs: int = 25
    time_column: Optional[str] = None


@router.post("/train")
async def train(
    file: UploadFile = File(...),
    target: str = Form(...),
    task: str | None = Form(None),
    n_trials: int = Form(15),
    cv: int = Form(5),
    families: str | None = Form(None),  # Comma-separated candidate families
):
    """
    Upload a CSV, name the target column, and train an optimized ML model
    with cross-validation and Optuna Bayesian hyperparameter search.
    """
    dest = _UPLOAD_DIR / (file.filename or "dataset.csv")
    with dest.open("wb") as out:
        shutil.copyfileobj(file.file, out)

    selected_fams = [f.strip() for f in families.split(",") if f.strip()] if families else None

    try:
        df = pd.read_csv(dest)
        result = train_and_register(
            df,
            target=target.strip(),
            task=task.strip() if task else None,
            n_trials=n_trials,
            cv=cv,
            selected_families=selected_fams,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return result


@router.get("/models")
def list_models():
    """Lists all registered machine learning models with key evaluation metrics."""
    return [
        {
            "model_id": r.model_id,
            "best_model_name": r.report.best_model_name,
            "best_score": r.report.best_score,
            "task": r.report.task,
            "target": r.report.target,
            "n_features": r.report.n_features,
            "n_rows": r.report.n_rows,
            "duration_s": r.report.duration_s,
        }
        for r in model_registry.list()
    ]


@router.get("/models/{model_id}")
def get_model_details(model_id: str):
    """Fetches full model specifications, Optuna trial leaderboard, and feature importance."""
    rec = model_registry.get(model_id)
    if not rec:
        raise HTTPException(status_code=404, detail=f"Model '{model_id}' not found")

    rep = rec.report
    return {
        "model_id": rec.model_id,
        "best_model_name": rep.best_model_name,
        "task": rep.task,
        "target": rep.target,
        "metric": rep.metric,
        "best_score": rep.best_score,
        "feature_columns": rec.feature_columns,
        "feature_importance": rep.feature_importance,
        "metrics": getattr(rep, "metrics", {}),
        "n_rows": rep.n_rows,
        "n_features": rep.n_features,
        "duration_s": rep.duration_s,
        "leaderboard": [
            {
                "name": c.name,
                "best_score": c.best_score,
                "best_params": c.best_params,
                "n_trials": c.n_trials,
                "score_std": getattr(c, "score_std", 0.0),
            }
            for c in rep.leaderboard
        ],
        "trial_history": getattr(rep, "trial_history", []),
    }


@router.post("/models/{model_id}/predict")
def predict(model_id: str, rows: list[dict]):
    """Generates real-time predictions for single or multiple row dictionaries."""
    try:
        return {"predictions": model_registry.predict(model_id, rows)}
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/models/{model_id}/batch-predict")
async def batch_predict(model_id: str, file: UploadFile = File(...)):
    """
    Uploads a CSV file, runs inference with the selected model,
    and returns the enriched CSV with added prediction and confidence columns.
    """
    try:
        content = await file.read()
        df = pd.read_csv(io.BytesIO(content))
        res_df, summary = run_batch_prediction(model_id, df)
        csv_buffer = io.StringIO()
        res_df.to_csv(csv_buffer, index=False)
        return Response(
            content=csv_buffer.getvalue(),
            media_type="text/csv",
            headers={
                "Content-Disposition": f'attachment; filename="predictions_{model_id}.csv"',
                "X-TarQ-Processed-Rows": str(summary["rows_processed"]),
            },
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/models/{model_id}/explain")
def explain_prediction(model_id: str, payload: ExplainRequest):
    """Computes waterfall feature contribution attributions for a single prediction row."""
    rec = model_registry.get(model_id)
    if not rec:
        raise HTTPException(status_code=404, detail=f"Model '{model_id}' not found")
    try:
        pipeline = joblib.load(rec.path)
        return explain_sample_prediction(
            pipeline=pipeline,
            row=payload.row,
            feature_columns=rec.feature_columns,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/models/{model_id}/download")
def download_model_bundle(model_id: str):
    """Exports and downloads a zip archive containing model.joblib, model card, and Python predictor."""
    try:
        zip_path = model_registry.export_bundle(model_id)
        return FileResponse(
            path=str(zip_path),
            filename=f"tarq_model_{model_id}.zip",
            media_type="application/zip",
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.delete("/models/{model_id}")
def delete_model(model_id: str):
    """Deletes a registered model from the registry."""
    success = model_registry.delete(model_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Model '{model_id}' not found")
    return {"status": "deleted", "model_id": model_id}


# ── Time Series Endpoints ──────────────────────────────────────────────────

@router.post("/timeseries/train")
async def train_timeseries(
    file: UploadFile = File(...),
    target_column: str = Form(...),
    architecture: str = Form("lstm"),
    lookback: int = Form(24),
    horizon: int = Form(6),
    scaler: str = Form("standard"),
    epochs: int = Form(25),
    time_column: Optional[str] = Form(None),
):
    """
    Trains a deep learning or autoregressive time-series forecasting model
    (LSTM, GRU, TCN, Transformer, N-BEATS) and returns loss trajectories and predictions.
    """
    dest = _UPLOAD_DIR / (file.filename or "timeseries_data.csv")
    with dest.open("wb") as out:
        shutil.copyfileobj(file.file, out)

    try:
        df = pd.read_csv(dest)
        res = train_timeseries_model(
            df=df,
            target_column=target_column.strip(),
            architecture=architecture.lower().strip(),
            lookback=lookback,
            horizon=horizon,
            scaler=scaler.lower().strip(),
            epochs=epochs,
            time_column=time_column.strip() if time_column else None,
        )
        return res.__dict__
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/timeseries/models")
def list_timeseries_models():
    """Lists all trained time series models."""
    return [m.__dict__ for m in ts_store.list()]


@router.get("/timeseries/models/{model_id}")
def get_timeseries_model(model_id: str):
    """Gets details and forecast outputs for a trained time series model."""
    entry = ts_store.get(model_id)
    if not entry:
        raise HTTPException(status_code=404, detail=f"Time series model '{model_id}' not found")
    return entry["result"].__dict__
