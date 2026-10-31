import pytest
from app.services.dataset_service import profile_dataframe


def test_profile_dataframe():
    data = [
        {"age": 25, "salary": 50000, "department": "Sales", "target_churn": "No"},
        {"age": 30, "salary": 60000, "department": "Engineering", "target_churn": "No"},
        {"age": 45, "salary": 85000, "department": "Sales", "target_churn": "Yes"},
        {"age": 50, "salary": 95000, "department": "HR", "target_churn": "No"},
        {"age": 60, "salary": 120000, "department": "Engineering", "target_churn": "Yes"},
    ]

    res = profile_dataframe(data)

    assert res["rows"] == 5
    assert res["columns_count"] == 4
    assert len(res["columns"]) == 4
    assert "age" in res["numeric_columns"]
    assert "salary" in res["numeric_columns"]
    assert "department" in res["categorical_columns"]
    assert "target_churn" in res["recommended_targets"]
    assert "age" in res["correlations"]
    assert res["correlations"]["age"]["salary"] > 0.8
