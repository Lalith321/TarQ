from unittest.mock import MagicMock
import numpy as np
import pytest

from app.ml.explainability import extract_feature_importance, explain_sample_prediction


def test_extract_feature_importance_tree():
    pipeline = MagicMock()
    model = MagicMock()
    model.feature_importances_ = np.array([0.5, 0.3, 0.2])
    pipeline.named_steps = {"model": model}

    importance = extract_feature_importance(pipeline, feature_names=["feat_a", "feat_b", "feat_c"])
    assert "feat_a" in importance
    assert importance["feat_a"] == 0.5


def test_explain_sample_prediction():
    pipeline = MagicMock()
    pipeline.predict.return_value = np.array([42.0])
    model = MagicMock()
    model.feature_importances_ = np.array([0.6, 0.4])
    pipeline.named_steps = {"model": model}

    row = {"feat_x": 10.0, "feat_y": 5.0}
    exp = explain_sample_prediction(
        pipeline=pipeline,
        row=row,
        feature_columns=["feat_x", "feat_y"],
    )

    assert exp["prediction"] == 42.0
    assert len(exp["top_features"]) == 2
    assert exp["top_features"][0]["feature"] == "feat_x"
