from __future__ import annotations

import json
import shutil
import uuid
import zipfile
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    import joblib
except ImportError:
    joblib = None
import pickle

try:
    import pandas as pd
except ImportError:
    pd = None
try:
    from sklearn.pipeline import Pipeline
except ImportError:
    Pipeline = Any

from .report_types import CandidateResult, TrainingReport
from ..core.workspace_paths import workspace_dir

_MODEL_DIR = workspace_dir() / "models"
try:
    _MODEL_DIR.mkdir(parents=True, exist_ok=True)
except (PermissionError, OSError):
    _MODEL_DIR = Path("/tmp/tarq_workspace") / "models"
    _MODEL_DIR.mkdir(parents=True, exist_ok=True)
_INDEX_FILE = _MODEL_DIR / "registry_index.json"


@dataclass
class ModelRecord:
    model_id: str
    report: TrainingReport
    feature_columns: list[str]
    path: Path


class ModelRegistry:
    def __init__(self) -> None:
        self._index: dict[str, ModelRecord] = {}
        self._load_from_disk()

    def _save_to_disk(self) -> None:
        data = {}
        for mid, rec in self._index.items():
            rep = rec.report
            data[mid] = {
                "model_id": rec.model_id,
                "feature_columns": rec.feature_columns,
                "path": str(rec.path),
                "report": {
                    "task": rep.task,
                    "target": rep.target,
                    "metric": rep.metric,
                    "best_model_name": rep.best_model_name,
                    "best_score": rep.best_score,
                    "feature_importance": rep.feature_importance,
                    "metrics": getattr(rep, "metrics", {}),
                    "n_rows": rep.n_rows,
                    "n_features": rep.n_features,
                    "duration_s": rep.duration_s,
                    "leaderboard": [
                        {
                            "name": c.name,
                            "best_score": c.best_score,
                            "best_params": c.best_params,
                            "n_trials": c.n_trials,
                            "score_std": getattr(c, "score_std", 0.0),
                        }
                        for c in rep.leaderboard
                    ],
                },
            }
        try:
            _INDEX_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")
        except Exception:
            pass

    def _load_from_disk(self) -> None:
        if not _INDEX_FILE.exists():
            return
        try:
            data = json.loads(_INDEX_FILE.read_text(encoding="utf-8"))
            for mid, item in data.items():
                p = Path(item["path"])
                if p.exists():
                    rep_data = item["report"]
                    lb = [
                        CandidateResult(
                            name=c["name"],
                            best_score=c["best_score"],
                            best_params=c["best_params"],
                            n_trials=c["n_trials"],
                            score_std=c.get("score_std", 0.0),
                        )
                        for c in rep_data.get("leaderboard", [])
                    ]
                    rep = TrainingReport(
                        task=rep_data["task"],
                        target=rep_data["target"],
                        metric=rep_data["metric"],
                        leaderboard=lb,
                        best_model_name=rep_data["best_model_name"],
                        best_score=rep_data["best_score"],
                        feature_importance=rep_data.get("feature_importance", {}),
                        metrics=rep_data.get("metrics", {}),
                        n_rows=rep_data.get("n_rows", 0),
                        n_features=rep_data.get("n_features", 0),
                        duration_s=rep_data.get("duration_s", 0.0),
                    )
                    self._index[mid] = ModelRecord(mid, rep, item["feature_columns"], p)
        except Exception:
            pass

    def save(self, pipeline: Pipeline, report: TrainingReport, feature_columns: list[str]) -> str:
        model_id = uuid.uuid4().hex[:12]
        path = _MODEL_DIR / f"{model_id}.joblib"
        if joblib is not None:
            joblib.dump(pipeline, path)
        else:
            with open(path, "wb") as f:
                pickle.dump(pipeline, f)
        self._index[model_id] = ModelRecord(model_id, report, feature_columns, path)
        self._save_to_disk()
        return model_id

    def get(self, model_id: str) -> ModelRecord | None:
        return self._index.get(model_id)

    def list(self) -> list[ModelRecord]:
        return list(self._index.values())

    def delete(self, model_id: str) -> bool:
        rec = self._index.pop(model_id, None)
        if rec:
            if rec.path.exists():
                rec.path.unlink(missing_ok=True)
            self._save_to_disk()
            return True
        return False

    def predict(self, model_id: str, rows: list[dict[str, Any]]) -> list[Any]:
        record = self._index.get(model_id)
        if record is None:
            raise KeyError(f"no model '{model_id}'")
        if joblib is not None:
            pipeline = joblib.load(record.path)
        else:
            with open(record.path, "rb") as f:
                pipeline = pickle.load(f)
        X = pd.DataFrame(rows)[record.feature_columns]
        return pipeline.predict(X).tolist()

    def export_bundle(self, model_id: str) -> Path:
        """Packages the model into a standalone downloadable zip file."""
        rec = self._index.get(model_id)
        if rec is None:
            raise KeyError(f"no model '{model_id}'")

        zip_path = _MODEL_DIR / f"tarq_model_{model_id}.zip"
        temp_dir = _MODEL_DIR / f"export_{model_id}"
        temp_dir.mkdir(parents=True, exist_ok=True)

        # Copy model artifact
        shutil.copy2(rec.path, temp_dir / "model.joblib")

        # Create model card
        card = {
            "model_id": rec.model_id,
            "best_model_name": rec.report.best_model_name,
            "task": rec.report.task,
            "target": rec.report.target,
            "best_score": rec.report.best_score,
            "feature_columns": rec.feature_columns,
            "feature_importance": rec.report.feature_importance,
            "metrics": getattr(rec.report, "metrics", {}),
        }
        (temp_dir / "model_card.json").write_text(json.dumps(card, indent=2), encoding="utf-8")

        # Standalone Python inference script
        script = f'''"""
TarQ Standalone Model Inference Script
Model ID: {rec.model_id}
Architecture: {rec.report.best_model_name}
Target: {rec.report.target}
"""
try:
    import joblib
except ImportError:
    joblib = None
import pickle

try:
    import pandas as pd
except ImportError:
    pd = None

FEATURES = {rec.feature_columns}

def predict(input_dict_or_df):
    model = joblib.load("model.joblib")
    if isinstance(input_dict_or_df, dict):
        df = pd.DataFrame([input_dict_or_df])
    elif isinstance(input_dict_or_df, list):
        df = pd.DataFrame(input_dict_or_df)
    else:
        df = input_dict_or_df
    return model.predict(df[FEATURES])

if __name__ == "__main__":
    print("Model loaded successfully. Features required:", FEATURES)
'''
        (temp_dir / "predict.py").write_text(script, encoding="utf-8")

        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for f in temp_dir.glob("*"):
                zf.write(f, arcname=f.name)

        shutil.rmtree(temp_dir, ignore_errors=True)
        return zip_path


model_registry = ModelRegistry()
