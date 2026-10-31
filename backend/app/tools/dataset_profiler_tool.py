"""
Dataset Profiler Tool — generates rich EDA summaries, correlations, and target recommendations.
"""
import json
from pathlib import Path
from typing import Annotated
import pandas as pd
from langchain_core.tools import tool

from app.services.dataset_service import profile_dataframe


@tool
def profile_dataset_file(
    csv_path: Annotated[str, "File path to the CSV dataset to inspect and profile."],
) -> str:
    """
    Analyzes and profiles a dataset: row/column counts, missing values,
    distribution stats, correlation matrix, and recommendations for ML target column.
    """
    path = Path(csv_path)
    if not path.exists():
        return json.dumps({"error": f"File '{csv_path}' does not exist"})

    try:
        df = pd.read_csv(path)
        profile = profile_dataframe(df)
        return json.dumps({"ok": True, "profile": profile})
    except Exception as exc:
        return json.dumps({"error": str(exc)})
