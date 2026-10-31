from __future__ import annotations

import io
from typing import Any, Dict, List, Tuple
import pandas as pd
from sklearn.pipeline import Pipeline
import joblib

from .registry import model_registry


def run_batch_prediction(
    model_id: str,
    df: pd.DataFrame,
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Runs batch inference on a Pandas DataFrame using a registered model pipeline.
    Appends 'tarq_prediction' and returns the annotated DataFrame and summary metrics.
    """
    record = model_registry.get(model_id)
    if record is None:
        raise KeyError(f"No model found with id '{model_id}'")

    pipeline: Pipeline = joblib.load(record.path)

    # Check missing feature columns
    missing_cols = [c for c in record.feature_columns if c not in df.columns]
    if missing_cols:
        raise ValueError(
            f"Input dataset is missing required features: {missing_cols}"
        )

    X = df[record.feature_columns]
    predictions = pipeline.predict(X)

    result_df = df.copy()
    result_df["tarq_prediction"] = predictions

    # If classification and probabilities supported, add max confidence
    if hasattr(pipeline, "predict_proba"):
        try:
            probs = pipeline.predict_proba(X)
            max_probs = probs.max(axis=1)
            result_df["tarq_confidence"] = [round(float(p), 4) for p in max_probs]
        except Exception:
            pass

    summary = {
        "model_id": model_id,
        "rows_processed": len(result_df),
        "target": record.report.target,
        "task": record.report.task,
        "features_used": record.feature_columns,
    }

    return result_df, summary
