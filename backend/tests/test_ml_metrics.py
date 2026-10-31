import numpy as np
import pytest

from app.ml.metrics import compute_classification_metrics, compute_regression_metrics


def test_compute_classification_metrics():
    y_true = np.array([0, 1, 0, 1, 1, 0])
    y_pred = np.array([0, 1, 0, 0, 1, 0])
    y_prob = np.array([[0.9, 0.1], [0.2, 0.8], [0.8, 0.2], [0.6, 0.4], [0.1, 0.9], [0.7, 0.3]])

    res = compute_classification_metrics(y_true, y_pred, y_prob)

    assert "accuracy" in res
    assert "confusion_matrix" in res
    assert "per_class" in res
    assert res["accuracy"] == round(5 / 6, 4)
    assert len(res["confusion_matrix"]) == 2


def test_compute_regression_metrics():
    y_true = np.array([10.0, 20.0, 30.0, 40.0, 50.0])
    y_pred = np.array([11.0, 19.0, 32.0, 38.0, 51.0])

    res = compute_regression_metrics(y_true, y_pred)

    assert "rmse" in res
    assert "mae" in res
    assert "r2" in res
    assert "actual_vs_predicted" in res
    assert res["mae"] > 0
    assert res["r2"] > 0.95
    assert len(res["actual_vs_predicted"]) == 5
