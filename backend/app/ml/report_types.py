from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List


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
