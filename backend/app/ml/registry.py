from __future__ import annotations

import tempfile
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import joblib
import pandas as pd
from sklearn.pipeline import Pipeline

from .trainer import TrainingReport

_MODEL_DIR = Path(tempfile.gettempdir()) / "dashboard_platform_models"
_MODEL_DIR.mkdir(exist_ok=True)


@dataclass
class ModelRecord:
    model_id: str
    report: TrainingReport
    feature_columns: list[str]
    path: Path


class ModelRegistry:
    def __init__(self) -> None:
        self._index: dict[str, ModelRecord] = {}

    def save(self, pipeline: Pipeline, report: TrainingReport, feature_columns: list[str]) -> str:
        model_id = uuid.uuid4().hex[:12]
        path = _MODEL_DIR / f"{model_id}.joblib"
        joblib.dump(pipeline, path)
        self._index[model_id] = ModelRecord(model_id, report, feature_columns, path)
        return model_id

    def get(self, model_id: str) -> ModelRecord | None:
        return self._index.get(model_id)

    def list(self) -> list[ModelRecord]:
        return list(self._index.values())

    def predict(self, model_id: str, rows: list[dict[str, Any]]) -> list[Any]:
        record = self._index.get(model_id)
        if record is None:
            raise KeyError(f"no model '{model_id}'")
        pipeline: Pipeline = joblib.load(record.path)
        X = pd.DataFrame(rows)[record.feature_columns]
        return pipeline.predict(X).tolist()


model_registry = ModelRegistry()
