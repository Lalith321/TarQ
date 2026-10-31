"""
Exposes train_and_register as a standalone LangChain tool. The tool call
itself is the only LLM involvement in getting a trained model — everything
inside (preprocessing, model selection, hyperparameter search) is pure
Optuna/sklearn. Deciding to call this tool, and picking `target`/`csv_path`,
is the extent of what an LLM does here.
"""
import sys
from pathlib import Path

_BACKEND = Path(__file__).resolve().parent.parent / "backend"
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

import json
from typing import Annotated, Optional

import pandas as pd
from langchain_core.tools import tool

from app.ml.service import train_and_register


@tool
def train_ml_model(
    csv_path: Annotated[str, "Path to a CSV file readable from this process."],
    target: Annotated[str, "Name of the column to predict."],
    task: Annotated[Optional[str], (
        "'classification' or 'regression'. Omit to auto-detect from the "
        "target column's dtype/cardinality — auto-detection is deterministic "
        "and usually correct; only override it if you have domain knowledge "
        "the column dtype can't capture (e.g. an integer column that's "
        "actually a regression target with few distinct values in this sample)."
    )] = None,
    n_trials: Annotated[int, "Optuna trials per candidate model family. 15-30 is a reasonable range; higher costs more time, not more LLM calls — this loop makes zero model calls regardless of n_trials."] = 20,
) -> str:
    """Train and register an ML model from a CSV with Optuna-tuned
    hyperparameters across a few candidate model families, entirely without
    LLM calls in the search loop. Returns the model_id, leaderboard, and a
    plain-language summary as JSON. Call this instead of writing your own
    training loop — it already handles missing values, categorical encoding,
    problem-type detection, and hyperparameter search."""
    df = pd.read_csv(csv_path)
    try:
        result = train_and_register(df, target=target, task=task, n_trials=n_trials)
    except ValueError as exc:
        return json.dumps({"ok": False, "error": str(exc)})
    return json.dumps({"ok": True, **result})
