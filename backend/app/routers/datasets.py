from __future__ import annotations

import io
from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd
from fastapi import APIRouter, File, HTTPException, UploadFile, Query

from app.services.dataset_service import profile_dataframe

router = APIRouter(prefix="/datasets", tags=["datasets"])


@router.post("/profile")
async def profile_dataset(file: UploadFile = File(...)):
    """Uploads a CSV dataset and returns comprehensive profiling metrics and correlations."""
    try:
        content = await file.read()
        df = pd.read_csv(io.BytesIO(content))
        return profile_dataframe(df)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to profile dataset: {str(exc)}")


@router.get("/sample")
def get_sample_dataset(dataset_type: str = Query("classification", regex="^(classification|regression|timeseries)$")):
    """Generates a rich, synthetic business dataset for instant studio experimentation."""
    np.random.seed(42)
    n_rows = 200

    if dataset_type == "classification":
        # Customer Churn dataset
        tenure = np.random.randint(1, 72, size=n_rows)
        monthly_charges = np.random.uniform(20.0, 120.0, size=n_rows)
        contract = np.random.choice(["Month-to-month", "One year", "Two year"], size=n_rows, p=[0.5, 0.3, 0.2])
        tech_support = np.random.choice(["Yes", "No"], size=n_rows, p=[0.4, 0.6])
        payment_method = np.random.choice(["Electronic check", "Mailed check", "Bank transfer"], size=n_rows)

        # Churn probability higher for month-to-month and high charges
        churn_prob = (
            0.1 + (monthly_charges / 150.0) * 0.3 + (contract == "Month-to-month") * 0.35 - (tech_support == "Yes") * 0.2
        )
        churn_prob = np.clip(churn_prob, 0.05, 0.95)
        churn = np.array(["Yes" if np.random.rand() < p else "No" for p in churn_prob])

        df = pd.DataFrame({
            "tenure_months": tenure,
            "monthly_charges": np.round(monthly_charges, 2),
            "contract_type": contract,
            "tech_support": tech_support,
            "payment_method": payment_method,
            "churn": churn,
        })
        return {
            "name": "Customer Churn (Classification)",
            "target": "churn",
            "task": "classification",
            "csv_data": df.to_csv(index=False),
            "profile": profile_dataframe(df),
        }

    elif dataset_type == "regression":
        # Housing / Real Estate Price dataset
        area_sqft = np.random.randint(600, 4500, size=n_rows)
        bedrooms = np.clip(np.random.poisson(3, size=n_rows), 1, 6)
        bathrooms = np.clip(bedrooms - np.random.randint(0, 2, size=n_rows), 1, 4)
        neighborhood = np.random.choice(["Downtown", "Suburbs", "Uptown", "Waterfront"], size=n_rows)
        age_years = np.random.randint(0, 50, size=n_rows)

        neigh_multiplier = {"Downtown": 1.4, "Waterfront": 1.8, "Uptown": 1.2, "Suburbs": 1.0}
        mult = np.array([neigh_multiplier[n] for n in neighborhood])

        price = (120000 + area_sqft * 180 + bedrooms * 15000 + bathrooms * 22000 - age_years * 1200) * mult
        price += np.random.normal(0, 15000, size=n_rows)

        df = pd.DataFrame({
            "area_sqft": area_sqft,
            "bedrooms": bedrooms,
            "bathrooms": bathrooms,
            "neighborhood": neighborhood,
            "property_age": age_years,
            "price_usd": np.round(price, 0).astype(int),
        })
        return {
            "name": "Property Pricing (Regression)",
            "target": "price_usd",
            "task": "regression",
            "csv_data": df.to_csv(index=False),
            "profile": profile_dataframe(df),
        }

    else:
        # Time Series: Daily Cloud Server Requests
        dates = pd.date_range(start="2026-01-01", periods=n_rows, freq="D")
        t = np.arange(n_rows)
        trend = 100.0 + 0.5 * t
        seasonality = 25.0 * np.sin(2 * np.pi * t / 7.0)  # weekly seasonality
        noise = np.random.normal(0, 5, size=n_rows)
        requests_count = trend + seasonality + noise

        df = pd.DataFrame({
            "timestamp": dates.strftime("%Y-%m-%d"),
            "server_requests": np.round(np.clip(requests_count, 10, None), 1),
            "cpu_utilization_pct": np.round(np.clip(trend * 0.3 + seasonality * 0.2 + noise, 10, 95), 1),
        })
        return {
            "name": "Cloud Operations (Time Series)",
            "target": "server_requests",
            "task": "timeseries",
            "csv_data": df.to_csv(index=False),
            "profile": profile_dataframe(df),
        }
