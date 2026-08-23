from __future__ import annotations

import pandas as pd


def detect_problem_type(y: pd.Series) -> str:
    """Dtype/cardinality heuristic — no LLM call needed to know that a
    5-category string column is a classification target."""
    if y.dtype == object or str(y.dtype) in ("category", "bool"):
        return "classification"
    non_null = y.dropna()
    looks_discrete = pd.api.types.is_integer_dtype(y) or (non_null % 1 == 0).all()
    if looks_discrete and non_null.nunique() <= 20:
        return "classification"
    return "regression"
