"""
OptunaTrainer — cross-validated hyperparameter search per candidate model
family via Optuna + sklearn. Preprocessing, model selection, hyperparameter
tuning, and evaluation are all deterministic and reproducible.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import numpy as np
import optuna
import pandas as pd
from sklearn.model_selection import cross_val_score, train_test_split
from sklearn.pipeline import Pipeline

from .explainability import extract_feature_importance
from .metrics import compute_classification_metrics, compute_regression_metrics
from .preprocessing import build_preprocessor
from .problem_type import detect_problem_type
from .report_types import CandidateResult, TrainingReport
from .search_space import ModelCandidate, get_candidates

optuna.logging.set_verbosity(optuna.logging.WARNING)


@dataclass
class CandidateResult:
    name: str
    best_score: float
    best_params: dict
    n_trials: int
    score_std: float = 0.0


@dataclass
class TrainingReport:
    task: str
    target: str
    metric: str
    leaderboard: list[CandidateResult]
    best_model_name: str
    best_score: float
    feature_importance: dict[str, float]
    metrics: dict[str, Any]
    n_rows: int
    n_features: int
    duration_s: float
    trial_history: list[dict[str, Any]] = field(default_factory=list)


class OptunaTrainer:
    def __init__(
        self,
        n_trials_per_model: int = 15,
        cv: int = 5,
        random_state: int = 42,
        selected_families: Optional[List[str]] = None,
    ):
        self.n_trials_per_model = max(3, n_trials_per_model)
        self.cv = max(2, cv)
        self.random_state = random_state
        self.selected_families = selected_families

    def run(
        self,
        X: pd.DataFrame,
        y: pd.Series,
        task: str | None = None,
    ) -> tuple[TrainingReport, Pipeline]:
        start = time.time()
        task = task or detect_problem_type(y)
        metric = "accuracy" if task == "classification" else "neg_root_mean_squared_error"

        # Holdout validation split for realistic post-training evaluation metrics
        test_size = 0.2 if len(X) >= 50 else 0.1
        X_train, X_val, y_train, y_val = train_test_split(
            X, y, test_size=test_size, random_state=self.random_state,
            stratify=y if (task == "classification" and y.value_counts().min() >= 2) else None
        )

        preprocessor = build_preprocessor(X_train)
        leaderboard: list[CandidateResult] = []
        best: tuple[float, str, dict, ModelCandidate] | None = None
        trial_history: list[dict[str, Any]] = []

        candidates = get_candidates(task, selected_families=self.selected_families)
        if not candidates:
            # Fallback if filtered out
            candidates = get_candidates(task)

        for candidate in candidates:
            study_trials: list[dict[str, Any]] = []

            def objective(trial: optuna.Trial, candidate: ModelCandidate = candidate) -> float:
                pipe = Pipeline([("pre", preprocessor), ("model", candidate.build(trial))])
                cv_splits = min(self.cv, max(2, len(X_train) // 5))
                scores = cross_val_score(pipe, X_train, y_train, cv=cv_splits, scoring=metric, n_jobs=-1)
                mean_score = float(np.mean(scores))
                trial.set_user_attr("score_std", float(np.std(scores)))
                return mean_score

            study = optuna.create_study(
                direction="maximize", sampler=optuna.samplers.TPESampler(seed=self.random_state)
            )
            study.optimize(objective, n_trials=self.n_trials_per_model, show_progress_bar=False)

            best_trial = study.best_trial
            score_std = best_trial.user_attrs.get("score_std", 0.0)

            leaderboard.append(CandidateResult(
                name=candidate.name,
                best_score=float(study.best_value),
                best_params=study.best_params,
                n_trials=len(study.trials),
                score_std=round(float(score_std), 4),
            ))

            for t in study.trials:
                trial_history.append({
                    "model": candidate.name,
                    "trial_number": t.number,
                    "score": round(float(t.value), 4) if t.value is not None else None,
                    "params": t.params,
                })

            if best is None or study.best_value > best[0]:
                best = (study.best_value, candidate.name, study.best_params, candidate)

        leaderboard.sort(key=lambda c: c.best_score, reverse=True)
        best_score, best_name, best_params, best_candidate = best

        # Refit winning pipeline on full training set
        fixed = optuna.trial.FixedTrial(best_params)
        final_pipeline = Pipeline([("pre", preprocessor), ("model", best_candidate.build(fixed))])
        final_pipeline.fit(X_train, y_train)

        # Compute validation predictions and comprehensive evaluation metrics
        y_val_pred = final_pipeline.predict(X_val)
        y_val_prob = None
        if task == "classification" and hasattr(final_pipeline, "predict_proba"):
            try:
                y_val_prob = final_pipeline.predict_proba(X_val)
            except Exception:
                y_val_prob = None

        if task == "classification":
            eval_metrics = compute_classification_metrics(y_val.to_numpy(), np.asarray(y_val_pred), y_val_prob)
        else:
            eval_metrics = compute_regression_metrics(y_val.to_numpy(), np.asarray(y_val_pred))

        # Finally fit on entire dataset (X, y) for deployed artifact
        final_pipeline.fit(X, y)

        feature_imp = extract_feature_importance(final_pipeline, feature_names=X.columns.tolist())

        report = TrainingReport(
            task=task,
            target=y.name or "target",
            metric=metric,
            leaderboard=leaderboard,
            best_model_name=best_name,
            best_score=round(float(best_score), 4),
            feature_importance=feature_imp,
            metrics=eval_metrics,
            n_rows=len(X),
            n_features=X.shape[1],
            duration_s=round(time.time() - start, 2),
            trial_history=trial_history,
        )
        return report, final_pipeline
