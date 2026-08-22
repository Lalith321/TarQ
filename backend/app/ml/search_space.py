from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

import optuna
from sklearn.ensemble import (
    GradientBoostingClassifier, GradientBoostingRegressor,
    RandomForestClassifier, RandomForestRegressor,
)
from sklearn.linear_model import LogisticRegression, Ridge


@dataclass
class ModelCandidate:
    name: str
    build: Callable[[optuna.trial.BaseTrial], object]


def get_candidates(task: str) -> list[ModelCandidate]:
    """sklearn-only by design (no xgboost/lightgbm dependency assumed to be
    installed) — add candidates here if those are available in your
    environment; the trainer loop doesn't care how many there are."""
    if task == "classification":
        return [
            ModelCandidate("logistic_regression", lambda t: LogisticRegression(
                C=t.suggest_float("C", 1e-3, 10, log=True), max_iter=1000)),
            ModelCandidate("random_forest", lambda t: RandomForestClassifier(
                n_estimators=t.suggest_int("n_estimators", 50, 300),
                max_depth=t.suggest_int("max_depth", 2, 20),
                min_samples_leaf=t.suggest_int("min_samples_leaf", 1, 10),
                random_state=42)),
            ModelCandidate("gradient_boosting", lambda t: GradientBoostingClassifier(
                n_estimators=t.suggest_int("n_estimators", 50, 300),
                learning_rate=t.suggest_float("learning_rate", 1e-3, 0.3, log=True),
                max_depth=t.suggest_int("max_depth", 2, 8),
                random_state=42)),
        ]
    return [
        ModelCandidate("ridge", lambda t: Ridge(alpha=t.suggest_float("alpha", 1e-3, 10, log=True))),
        ModelCandidate("random_forest", lambda t: RandomForestRegressor(
            n_estimators=t.suggest_int("n_estimators", 50, 300),
            max_depth=t.suggest_int("max_depth", 2, 20),
            min_samples_leaf=t.suggest_int("min_samples_leaf", 1, 10),
            random_state=42)),
        ModelCandidate("gradient_boosting", lambda t: GradientBoostingRegressor(
            n_estimators=t.suggest_int("n_estimators", 50, 300),
            learning_rate=t.suggest_float("learning_rate", 1e-3, 0.3, log=True),
            max_depth=t.suggest_int("max_depth", 2, 8),
            random_state=42)),
    ]
