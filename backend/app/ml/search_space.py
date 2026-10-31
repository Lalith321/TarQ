from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, List, Optional

import optuna
from sklearn.ensemble import (
    GradientBoostingClassifier, GradientBoostingRegressor,
    RandomForestClassifier, RandomForestRegressor,
    ExtraTreesClassifier, ExtraTreesRegressor,
    HistGradientBoostingClassifier, HistGradientBoostingRegressor,
)
from sklearn.linear_model import LogisticRegression, Ridge, Lasso, ElasticNet
from sklearn.neural_network import MLPClassifier, MLPRegressor


@dataclass
class ModelCandidate:
    name: str
    build: Callable[[optuna.trial.BaseTrial], object]


def get_candidates(task: str, selected_families: Optional[List[str]] = None) -> list[ModelCandidate]:
    """
    Returns candidate model families for Optuna hyperparameter optimization.
    Includes Linear/Logistic, Tree Ensembles, Histogram Gradient Boosters (LightGBM-style),
    and Multi-Layer Perceptron (Neural Nets). Optionally filters by selected_families.
    """
    candidates: list[ModelCandidate] = []

    if task == "classification":
        candidates = [
            ModelCandidate(
                "random_forest",
                lambda t: RandomForestClassifier(
                    n_estimators=t.suggest_int("n_estimators", 30, 250),
                    max_depth=t.suggest_int("max_depth", 3, 20),
                    min_samples_leaf=t.suggest_int("min_samples_leaf", 1, 8),
                    random_state=42,
                    n_jobs=-1,
                ),
            ),
            ModelCandidate(
                "gradient_boosting",
                lambda t: GradientBoostingClassifier(
                    n_estimators=t.suggest_int("n_estimators", 40, 200),
                    learning_rate=t.suggest_float("learning_rate", 0.01, 0.3, log=True),
                    max_depth=t.suggest_int("max_depth", 2, 7),
                    random_state=42,
                ),
            ),
            ModelCandidate(
                "hist_gradient_boosting",
                lambda t: HistGradientBoostingClassifier(
                    max_iter=t.suggest_int("max_iter", 50, 200),
                    learning_rate=t.suggest_float("learning_rate", 0.01, 0.3, log=True),
                    max_leaf_nodes=t.suggest_int("max_leaf_nodes", 15, 63),
                    random_state=42,
                ),
            ),
            ModelCandidate(
                "extra_trees",
                lambda t: ExtraTreesClassifier(
                    n_estimators=t.suggest_int("n_estimators", 30, 200),
                    max_depth=t.suggest_int("max_depth", 3, 20),
                    min_samples_split=t.suggest_int("min_samples_split", 2, 10),
                    random_state=42,
                    n_jobs=-1,
                ),
            ),
            ModelCandidate(
                "logistic_regression",
                lambda t: LogisticRegression(
                    C=t.suggest_float("C", 1e-3, 10.0, log=True),
                    max_iter=1000,
                    random_state=42,
                ),
            ),
            ModelCandidate(
                "neural_network",
                lambda t: MLPClassifier(
                    hidden_layer_sizes=t.suggest_categorical("hidden_layer_sizes", [(64,), (128, 64), (64, 32)]),
                    alpha=t.suggest_float("alpha", 1e-5, 1e-1, log=True),
                    max_iter=300,
                    random_state=42,
                ),
            ),
        ]
    else:
        # Regression
        candidates = [
            ModelCandidate(
                "random_forest",
                lambda t: RandomForestRegressor(
                    n_estimators=t.suggest_int("n_estimators", 30, 250),
                    max_depth=t.suggest_int("max_depth", 3, 20),
                    min_samples_leaf=t.suggest_int("min_samples_leaf", 1, 8),
                    random_state=42,
                    n_jobs=-1,
                ),
            ),
            ModelCandidate(
                "gradient_boosting",
                lambda t: GradientBoostingRegressor(
                    n_estimators=t.suggest_int("n_estimators", 40, 200),
                    learning_rate=t.suggest_float("learning_rate", 0.01, 0.3, log=True),
                    max_depth=t.suggest_int("max_depth", 2, 7),
                    random_state=42,
                ),
            ),
            ModelCandidate(
                "hist_gradient_boosting",
                lambda t: HistGradientBoostingRegressor(
                    max_iter=t.suggest_int("max_iter", 50, 200),
                    learning_rate=t.suggest_float("learning_rate", 0.01, 0.3, log=True),
                    max_leaf_nodes=t.suggest_int("max_leaf_nodes", 15, 63),
                    random_state=42,
                ),
            ),
            ModelCandidate(
                "extra_trees",
                lambda t: ExtraTreesRegressor(
                    n_estimators=t.suggest_int("n_estimators", 30, 200),
                    max_depth=t.suggest_int("max_depth", 3, 20),
                    min_samples_split=t.suggest_int("min_samples_split", 2, 10),
                    random_state=42,
                    n_jobs=-1,
                ),
            ),
            ModelCandidate(
                "ridge",
                lambda t: Ridge(
                    alpha=t.suggest_float("alpha", 1e-3, 50.0, log=True),
                    random_state=42,
                ),
            ),
            ModelCandidate(
                "elastic_net",
                lambda t: ElasticNet(
                    alpha=t.suggest_float("alpha", 1e-3, 10.0, log=True),
                    l1_ratio=t.suggest_float("l1_ratio", 0.1, 0.9),
                    max_iter=1000,
                    random_state=42,
                ),
            ),
            ModelCandidate(
                "neural_network",
                lambda t: MLPRegressor(
                    hidden_layer_sizes=t.suggest_categorical("hidden_layer_sizes", [(64,), (128, 64), (64, 32)]),
                    alpha=t.suggest_float("alpha", 1e-5, 1e-1, log=True),
                    max_iter=300,
                    random_state=42,
                ),
            ),
        ]

    # Optional XGBoost / LightGBM if installed
    try:
        import xgboost as xgb
        if task == "classification":
            candidates.append(
                ModelCandidate(
                    "xgboost",
                    lambda t: xgb.XGBClassifier(
                        n_estimators=t.suggest_int("n_estimators", 40, 200),
                        learning_rate=t.suggest_float("learning_rate", 0.01, 0.3, log=True),
                        max_depth=t.suggest_int("max_depth", 2, 8),
                        random_state=42,
                        eval_metric="logloss",
                    ),
                )
            )
        else:
            candidates.append(
                ModelCandidate(
                    "xgboost",
                    lambda t: xgb.XGBRegressor(
                        n_estimators=t.suggest_int("n_estimators", 40, 200),
                        learning_rate=t.suggest_float("learning_rate", 0.01, 0.3, log=True),
                        max_depth=t.suggest_int("max_depth", 2, 8),
                        random_state=42,
                    ),
                )
            )
    except ImportError:
        pass

    if selected_families:
        candidates = [c for c in candidates if c.name in selected_families]

    return candidates
