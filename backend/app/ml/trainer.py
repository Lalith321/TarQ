"""
OptunaTrainer — cross-validated hyperparameter search per candidate model
family, entirely via Optuna + sklearn. No LLM call happens anywhere in this
loop; quality comes from the number of trials and the search space, not
from asking a model to guess hyperparameters. See ml/explain.py for the
one optional, single, post-hoc LLM touchpoint in this whole system.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field

import numpy as np
import optuna
import pandas as pd
from sklearn.model_selection import cross_val_score
from sklearn.pipeline import Pipeline

from .preprocessing import build_preprocessor
from .problem_type import detect_problem_type
from .search_space import ModelCandidate, get_candidates

optuna.logging.set_verbosity(optuna.logging.WARNING)


@dataclass
class CandidateResult:
    name: str
    best_score: float
    best_params: dict
    n_trials: int


@dataclass
class TrainingReport:
    task: str
    target: str
    metric: str
    leaderboard: list[CandidateResult]
    best_model_name: str
    best_score: float
    feature_importance: dict[str, float]
    n_rows: int
    n_features: int
    duration_s: float


def _extract_feature_importance(pipeline: Pipeline, top_k: int = 15) -> dict[str, float]:
    try:
        names = pipeline.named_steps["pre"].get_feature_names_out()
    except Exception:
        return {}
    model = pipeline.named_steps["model"]
    if hasattr(model, "feature_importances_"):
        values = model.feature_importances_
    elif hasattr(model, "coef_"):
        coef = model.coef_
        values = np.abs(coef).mean(axis=0) if coef.ndim > 1 else np.abs(coef)
    else:
        return {}
    ranked = sorted(zip(names, values), key=lambda p: p[1], reverse=True)[:top_k]
    return {str(n): float(v) for n, v in ranked}


class OptunaTrainer:
    def __init__(self, n_trials_per_model: int = 20, cv: int = 5, random_state: int = 42):
        self.n_trials_per_model = n_trials_per_model
        self.cv = cv
        self.random_state = random_state

    def run(self, X: pd.DataFrame, y: pd.Series, task: str | None = None) -> tuple[TrainingReport, Pipeline]:
        start = time.time()
        task = task or detect_problem_type(y)
        metric = "accuracy" if task == "classification" else "neg_root_mean_squared_error"
        preprocessor = build_preprocessor(X)

        leaderboard: list[CandidateResult] = []
        best: tuple[float, str, dict, ModelCandidate] | None = None

        for candidate in get_candidates(task):
            def objective(trial: optuna.Trial, candidate: ModelCandidate = candidate) -> float:
                pipe = Pipeline([("pre", preprocessor), ("model", candidate.build(trial))])
                scores = cross_val_score(pipe, X, y, cv=self.cv, scoring=metric, n_jobs=-1)
                return float(np.mean(scores))

            study = optuna.create_study(
                direction="maximize", sampler=optuna.samplers.TPESampler(seed=self.random_state)
            )
            study.optimize(objective, n_trials=self.n_trials_per_model, show_progress_bar=False)

            leaderboard.append(CandidateResult(
                name=candidate.name, best_score=study.best_value,
                best_params=study.best_params, n_trials=len(study.trials),
            ))
            if best is None or study.best_value > best[0]:
                best = (study.best_value, candidate.name, study.best_params, candidate)

        leaderboard.sort(key=lambda c: c.best_score, reverse=True)
        best_score, best_name, best_params, best_candidate = best

        # Rebuild the winning estimator from its stored best_params (no
        # re-search) and refit on the full dataset for the final artifact.
        fixed = optuna.trial.FixedTrial(best_params)
        final_pipeline = Pipeline([("pre", preprocessor), ("model", best_candidate.build(fixed))])
        final_pipeline.fit(X, y)

        report = TrainingReport(
            task=task, target=y.name or "target", metric=metric,
            leaderboard=leaderboard, best_model_name=best_name, best_score=best_score,
            feature_importance=_extract_feature_importance(final_pipeline),
            n_rows=len(X), n_features=X.shape[1], duration_s=time.time() - start,
        )
        return report, final_pipeline
