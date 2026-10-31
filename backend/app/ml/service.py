from __future__ import annotations

from typing import List, Optional

import pandas as pd

from .explain import ExplainFn, summarize_report
from .registry import model_registry
from .trainer import OptunaTrainer


def train_and_register(
    df: pd.DataFrame,
    target: str,
    task: Optional[str] = None,
    n_trials: int = 15,
    cv: int = 5,
    selected_families: Optional[List[str]] = None,
    explain_fn: Optional[ExplainFn] = None,
) -> dict:
    if target not in df.columns:
        raise ValueError(f"target column '{target}' not in dataframe (columns: {list(df.columns)})")

    y = df[target]
    X = df.drop(columns=[target])
    feature_columns = X.columns.tolist()

    trainer = OptunaTrainer(
        n_trials_per_model=n_trials,
        cv=cv,
        selected_families=selected_families,
    )
    report, pipeline = trainer.run(X, y, task=task)
    model_id = model_registry.save(pipeline, report, feature_columns)

    return {
        "model_id": model_id,
        "task": report.task,
        "target": report.target,
        "metric": report.metric,
        "best_model_name": report.best_model_name,
        "best_score": report.best_score,
        "leaderboard": [
            {
                "name": c.name,
                "best_score": c.best_score,
                "best_params": c.best_params,
                "n_trials": c.n_trials,
                "score_std": getattr(c, "score_std", 0.0),
            }
            for c in report.leaderboard
        ],
        "feature_importance": report.feature_importance,
        "metrics": getattr(report, "metrics", {}),
        "n_rows": report.n_rows,
        "n_features": report.n_features,
        "duration_s": report.duration_s,
        "trial_history": getattr(report, "trial_history", []),
        "summary": summarize_report(report, explain_fn=explain_fn),
    }
