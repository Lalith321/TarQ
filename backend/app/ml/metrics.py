from __future__ import annotations

import math
from typing import Any, Dict, List, Optional
import numpy as np


def compute_classification_metrics(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    y_prob: Optional[np.ndarray] = None,
    max_scatter_points: int = 50,
) -> Dict[str, Any]:
    """Computes comprehensive classification metrics and confusion matrix."""
    labels = np.unique(np.concatenate([y_true, y_pred]))
    label_to_idx = {l: i for i, l in enumerate(labels)}
    num_labels = len(labels)

    # Confusion matrix
    cm = np.zeros((num_labels, num_labels), dtype=int)
    for t, p in zip(y_true, y_pred):
        cm[label_to_idx[t], label_to_idx[p]] += 1

    total = len(y_true)
    correct = int(np.sum(y_true == y_pred))
    accuracy = float(correct / total) if total > 0 else 0.0

    # Per-class precision, recall, f1
    per_class = {}
    f1_list = []
    prec_list = []
    rec_list = []

    for label in labels:
        idx = label_to_idx[label]
        tp = float(cm[idx, idx])
        fp = float(np.sum(cm[:, idx]) - tp)
        fn = float(np.sum(cm[idx, :]) - tp)

        prec = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        rec = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = (2 * prec * rec / (prec + rec)) if (prec + rec) > 0 else 0.0

        support = int(np.sum(cm[idx, :]))
        per_class[str(label)] = {
            "precision": round(prec, 4),
            "recall": round(rec, 4),
            "f1": round(f1, 4),
            "support": support,
        }
        f1_list.append(f1)
        prec_list.append(prec)
        rec_list.append(rec)

    macro_f1 = float(np.mean(f1_list)) if f1_list else 0.0
    macro_prec = float(np.mean(prec_list)) if prec_list else 0.0
    macro_rec = float(np.mean(rec_list)) if rec_list else 0.0

    # Estimate ROC-AUC if binary classification
    roc_auc = None
    if num_labels == 2 and y_prob is not None:
        try:
            # Positive class probabilities
            pos_prob = y_prob[:, 1] if y_prob.ndim == 2 else y_prob
            # Compute Wilcoxon-Mann-Whitney statistic for AUC
            pos_mask = (y_true == labels[1])
            n_pos = np.sum(pos_mask)
            n_neg = len(y_true) - n_pos
            if n_pos > 0 and n_neg > 0:
                pos_ranks = np.argsort(np.argsort(pos_prob)) + 1
                auc_stat = (np.sum(pos_ranks[pos_mask]) - n_pos * (n_pos + 1) / 2) / (n_pos * n_neg)
                roc_auc = round(float(auc_stat), 4)
        except Exception:
            roc_auc = None

    return {
        "accuracy": round(accuracy, 4),
        "f1_macro": round(macro_f1, 4),
        "precision_macro": round(macro_prec, 4),
        "recall_macro": round(macro_rec, 4),
        "roc_auc": roc_auc,
        "classes": [str(l) for l in labels],
        "confusion_matrix": cm.tolist(),
        "per_class": per_class,
    }


def compute_regression_metrics(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    max_scatter_points: int = 50,
) -> Dict[str, Any]:
    """Computes comprehensive regression metrics and residual statistics."""
    y_t = np.asarray(y_true, dtype=float)
    y_p = np.asarray(y_pred, dtype=float)

    diff = y_t - y_p
    sq_err = diff ** 2
    abs_err = np.abs(diff)

    mse = float(np.mean(sq_err))
    rmse = float(math.sqrt(mse))
    mae = float(np.mean(abs_err))
    max_err = float(np.max(abs_err)) if len(abs_err) > 0 else 0.0

    # R-squared
    ss_tot = float(np.sum((y_t - np.mean(y_t)) ** 2))
    ss_res = float(np.sum(sq_err))
    r2 = 1.0 - (ss_res / ss_tot) if ss_tot > 0 else 0.0

    # MAPE (filter zero target values)
    non_zero_mask = (y_t != 0)
    if np.any(non_zero_mask):
        mape = float(np.mean(np.abs(diff[non_zero_mask] / y_t[non_zero_mask])) * 100)
    else:
        mape = 0.0

    # Residual stats
    residuals = diff.tolist()
    res_mean = float(np.mean(diff))
    res_std = float(np.std(diff))

    # Sample actual vs predicted points for frontend visualization
    n_pts = min(len(y_t), max_scatter_points)
    sample_indices = np.linspace(0, len(y_t) - 1, n_pts, dtype=int)
    actual_vs_predicted = [
        {
            "index": int(i),
            "actual": round(float(y_t[i]), 3),
            "predicted": round(float(y_p[i]), 3),
            "residual": round(float(diff[i]), 3),
        }
        for i in sample_indices
    ]

    return {
        "rmse": round(rmse, 4),
        "mae": round(mae, 4),
        "r2": round(r2, 4),
        "mape": round(mape, 2),
        "max_error": round(max_err, 4),
        "residual_stats": {
            "mean": round(res_mean, 4),
            "std": round(res_std, 4),
        },
        "actual_vs_predicted": actual_vs_predicted,
    }
