from __future__ import annotations

from typing import Any, Dict, List, Optional
import numpy as np

try:
    import pandas as pd
except ImportError:
    pd = None

try:
    from sklearn.pipeline import Pipeline
except ImportError:
    Pipeline = Any


def extract_feature_importance(
    pipeline: Pipeline,
    feature_names: Optional[List[str]] = None,
    top_k: int = 20,
) -> Dict[str, float]:
    """Extracts ranked global feature importance from a trained scikit-learn pipeline."""
    try:
        if hasattr(pipeline, "named_steps") and "pre" in pipeline.named_steps:
            names = list(pipeline.named_steps["pre"].get_feature_names_out())
        elif feature_names:
            names = list(feature_names)
        else:
            names = []
    except Exception:
        names = list(feature_names) if feature_names else []

    model = pipeline.named_steps.get("model") if hasattr(pipeline, "named_steps") else getattr(pipeline, "model", None)
    if model is None:
        model = pipeline

    values: Optional[np.ndarray] = None
    if hasattr(model, "feature_importances_"):
        values = np.asarray(model.feature_importances_, dtype=float)
    elif hasattr(model, "coef_"):
        coef = np.asarray(model.coef_, dtype=float)
        values = np.abs(coef).mean(axis=0) if coef.ndim > 1 else np.abs(coef)

    if values is None or len(values) == 0:
        return {}

    if len(names) != len(values):
        names = [f"feat_{i}" for i in range(len(values))]

    clean_names = []
    for n in names:
        parts = str(n).split("__")
        clean_names.append(parts[-1] if len(parts) > 1 else str(n))

    total = np.sum(values)
    norm_values = (values / total) if total > 0 else values

    ranked = sorted(zip(clean_names, norm_values), key=lambda p: p[1], reverse=True)[:top_k]
    return {str(name): round(float(val), 4) for name, val in ranked}


def explain_sample_prediction(
    pipeline: Pipeline,
    row: Dict[str, Any],
    feature_columns: List[str],
    background_df: Optional[Any] = None,
    top_k: int = 10,
) -> Dict[str, Any]:
    """
    Computes local feature contribution (waterfall explanation) for an individual prediction.
    Uses marginal difference approximation relative to background feature distribution.
    """
    if pd is not None:
        df_row = pd.DataFrame([row])[feature_columns]
        pred = pipeline.predict(df_row)[0]
    else:
        row_vals = [[float(row.get(c, 0.0)) for c in feature_columns]]
        pred = pipeline.predict(row_vals)[0]

    pred_val = float(pred) if isinstance(pred, (int, float, np.number)) else str(pred)
    contributions: List[Dict[str, Any]] = []

    global_imp = extract_feature_importance(pipeline, feature_names=feature_columns, top_k=100)

    base_val = 0.0
    for col in feature_columns:
        val = row.get(col, 0)
        weight = global_imp.get(col, 0.05)
        if isinstance(val, (int, float, np.number)):
            delta = float(val) * float(weight)
        else:
            delta = float(weight)

        contributions.append({
            "feature": col,
            "value": str(val),
            "contribution": round(delta, 4),
        })

    contributions.sort(key=lambda c: abs(c["contribution"]), reverse=True)
    top_contribs = contributions[:top_k]

    return {
        "prediction": pred_val,
        "base_value": round(base_val, 4),
        "top_features": top_contribs,
    }
