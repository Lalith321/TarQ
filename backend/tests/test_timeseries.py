import numpy as np
import pytest

from app.ml.timeseries import _create_sliding_windows, train_timeseries_model, ts_store


def test_create_sliding_windows():
    series = np.arange(10, dtype=float)
    X, y = _create_sliding_windows(series, lookback=4, horizon=2)
    # len is 10 - 4 - 2 + 1 = 5
    assert len(X) == 5
    assert len(y) == 5
    assert np.array_equal(X[0], [0, 1, 2, 3])
    assert np.array_equal(y[0], [4, 5])


def test_train_timeseries_model():
    # Synthetic time series data
    t = np.arange(60)
    values = 10.0 + 0.5 * t + np.sin(t / 3.0) * 3.0
    data = [{"timestamp": int(i), "load": float(values[i])} for i in range(len(t))]

    result = train_timeseries_model(
        df=data,
        target_column="load",
        architecture="lstm",
        lookback=12,
        horizon=4,
        scaler="standard",
        epochs=5,
    )

    assert result.model_id.startswith("ts_")
    assert result.architecture == "lstm"
    assert "mae" in result.metrics
    assert len(result.future_forecast) == 4
    assert len(result.loss_history) == 5

    stored = ts_store.get(result.model_id)
    assert stored is not None
