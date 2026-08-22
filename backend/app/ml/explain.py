"""
The only place an LLM is allowed to touch the ML pipeline: turning an
already-computed TrainingReport into plain-language prose. It never
influences which model wins or what hyperparameters get tried — that's
Optuna's job, already finished by the time this runs. `explain_fn` is
optional and called at most once per training run; the deterministic
template is what runs by default (and is what "minimize LLM use" means in
practice here: zero calls unless the caller explicitly wants prose).
"""
from __future__ import annotations

from typing import Callable, Optional

from .trainer import TrainingReport

ExplainFn = Callable[[str], str]


def _template_summary(report: TrainingReport) -> str:
    lines = [
        f"Best model: {report.best_model_name} ({report.metric}={report.best_score:.4f}) "
        f"on {report.n_rows} rows / {report.n_features} features, task={report.task}.",
        "Leaderboard: " + ", ".join(f"{c.name}={c.best_score:.4f}" for c in report.leaderboard),
    ]
    if report.feature_importance:
        top = list(report.feature_importance.items())[:5]
        lines.append("Top features: " + ", ".join(f"{n} ({v:.3f})" for n, v in top))
    return " ".join(lines)


def summarize_report(report: TrainingReport, explain_fn: Optional[ExplainFn] = None) -> str:
    template = _template_summary(report)
    if explain_fn is None:
        return template
    prompt = (
        "Rewrite this model-training result as 2-3 plain-language sentences "
        "for a non-technical stakeholder. Do not invent numbers not present "
        f"here.\n\n{template}"
    )
    try:
        return explain_fn(prompt)
    except Exception:
        return template  # LLM is decoration here, never load-bearing
