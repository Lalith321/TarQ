from __future__ import annotations

import math
from typing import Any, Dict, List, Optional, Union
import numpy as np

try:
    import pandas as pd
except ImportError:
    pd = None


def profile_dataframe(
    data: Union[Any, List[Dict[str, Any]]],
    max_rows_preview: int = 15,
) -> Dict[str, Any]:
    """
    Computes an extensive exploratory data analysis (EDA) profile of tabular data.
    Works with both pandas DataFrames and native Python row-dict collections.
    Includes data health, semantic types, distributions, correlations, and outliers.
    """
    # Normalize input into columns dict: col_name -> list of values
    if pd is not None and isinstance(data, pd.DataFrame):
        df = data
        n_rows, n_cols = df.shape
        col_names = list(df.columns)
        raw_columns = {c: df[c].tolist() for c in col_names}
        preview = df.head(max_rows_preview).fillna("").to_dict(orient="records")
    elif isinstance(data, list) and len(data) > 0 and isinstance(data[0], dict):
        col_names = list(data[0].keys())
        n_rows = len(data)
        n_cols = len(col_names)
        raw_columns = {c: [row.get(c) for row in data] for c in col_names}
        preview = data[:max_rows_preview]
    elif isinstance(data, dict):
        col_names = list(data.keys())
        n_rows = len(next(iter(data.values()))) if data else 0
        n_cols = len(col_names)
        raw_columns = data
        preview = [{c: raw_columns[c][i] for c in col_names} for i in range(min(n_rows, max_rows_preview))]
    else:
        return {
            "rows": 0,
            "columns_count": 0,
            "columns": [],
            "numeric_columns": [],
            "categorical_columns": [],
            "correlations": {},
            "recommended_targets": [],
            "preview": [],
        }

    columns_profile = []
    numeric_cols = []
    categorical_cols = []
    numeric_arrays: Dict[str, np.ndarray] = {}

    for col in col_names:
        vals = raw_columns[col]
        null_count = sum(1 for v in vals if v is None or (isinstance(v, float) and math.isnan(v)) or v == "")
        null_pct = round(float(null_count / n_rows * 100), 2) if n_rows > 0 else 0.0

        # Non-null values
        valid_vals = [v for v in vals if v is not None and not (isinstance(v, float) and math.isnan(v)) and v != ""]
        distinct_vals = set(str(v) for v in valid_vals)
        n_unique = len(distinct_vals)

        # Check if numeric
        is_num = False
        num_floats: List[float] = []
        if valid_vals:
            try:
                num_floats = [float(v) for v in valid_vals]
                is_num = True
            except (ValueError, TypeError):
                is_num = False

        col_info: Dict[str, Any] = {
            "name": col,
            "null_count": null_count,
            "null_pct": null_pct,
            "distinct_count": n_unique,
        }

        if is_num and len(num_floats) > 0:
            col_info["semantic_type"] = "numeric"
            col_info["raw_dtype"] = "float64"
            numeric_cols.append(col)
            arr = np.asarray(num_floats, dtype=float)
            numeric_arrays[col] = arr

            q25, q50, q75 = np.percentile(arr, [25, 50, 75])
            iqr = q75 - q25
            outliers = int(np.sum((arr < (q25 - 1.5 * iqr)) | (arr > (q75 + 1.5 * iqr))))

            col_info["stats"] = {
                "min": round(float(np.min(arr)), 3),
                "max": round(float(np.max(arr)), 3),
                "mean": round(float(np.mean(arr)), 3),
                "median": round(float(q50), 3),
                "std": round(float(np.std(arr)), 3) if len(arr) > 1 else 0.0,
                "q25": round(float(q25), 3),
                "q75": round(float(q75), 3),
                "outlier_count": outliers,
            }
        else:
            col_info["semantic_type"] = "categorical"
            col_info["raw_dtype"] = "string"
            categorical_cols.append(col)

            # Frequency counts for top 5
            counts: Dict[str, int] = {}
            for v in valid_vals:
                s_val = str(v)
                counts[s_val] = counts.get(s_val, 0) + 1
            sorted_counts = sorted(counts.items(), key=lambda x: x[1], reverse=True)[:5]
            col_info["top_categories"] = {k: v for k, v in sorted_counts}

        columns_profile.append(col_info)

    # Compute correlation matrix for numeric columns
    correlations: Dict[str, Dict[str, float]] = {}
    subset_num = numeric_cols[:15]
    if len(subset_num) >= 2:
        for c1 in subset_num:
            correlations[c1] = {}
            arr1 = numeric_arrays[c1]
            for c2 in subset_num:
                arr2 = numeric_arrays[c2]
                if len(arr1) == len(arr2) and len(arr1) > 1:
                    std1 = np.std(arr1)
                    std2 = np.std(arr2)
                    if std1 > 1e-9 and std2 > 1e-9:
                        r = float(np.corrcoef(arr1, arr2)[0, 1])
                        correlations[c1][c2] = round(r, 3) if not math.isnan(r) else 0.0
                    else:
                        correlations[c1][c2] = 1.0 if c1 == c2 else 0.0
                else:
                    correlations[c1][c2] = 1.0 if c1 == c2 else 0.0

    # Target recommendations
    recommended_targets = []
    for c in col_names:
        c_lower = c.lower()
        if any(term in c_lower for term in ("target", "label", "outcome", "churn", "price", "sales", "status", "revenue")):
            recommended_targets.append(c)
    if not recommended_targets and len(col_names) > 0:
        recommended_targets.append(col_names[-1])

    return {
        "rows": n_rows,
        "columns_count": n_cols,
        "columns": columns_profile,
        "numeric_columns": numeric_cols,
        "categorical_columns": categorical_cols,
        "correlations": correlations,
        "recommended_targets": recommended_targets,
        "preview": preview,
    }
