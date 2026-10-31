from __future__ import annotations

import io
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.ml.sagemaker import sagemaker_service

router = APIRouter(prefix="/ml/sagemaker", tags=["sagemaker"])


class SageMakerConfigPayload(BaseModel):
    aws_access_key_id: Optional[str] = None
    aws_secret_access_key: Optional[str] = None
    aws_session_token: Optional[str] = None
    region_name: Optional[str] = None
    s3_bucket: Optional[str] = None
    role_arn: Optional[str] = None
    simulation_mode: Optional[bool] = None


class DeployEndpointPayload(BaseModel):
    endpoint_name: str
    model_id: str
    instance_type: str = "ml.m5.large"


class InvokeEndpointPayload(BaseModel):
    rows: List[Dict[str, Any]]


@router.get("/status")
def get_sagemaker_status():
    """Returns AWS SageMaker connection status, region, bucket, and active resources."""
    return sagemaker_service.get_status()


@router.post("/config")
def update_sagemaker_config(payload: SageMakerConfigPayload):
    """Updates AWS SageMaker credentials, regions, and execution parameters."""
    return sagemaker_service.update_config(payload.model_dump(exclude_unset=True))


@router.post("/train")
async def launch_sagemaker_training(
    job_name: Optional[str] = Form(None),
    dataset_s3_uri: Optional[str] = Form(None),
    target_column: str = Form("target"),
    framework: str = Form("scikit-learn"),
    instance_type: str = Form("ml.m5.xlarge"),
    file: Optional[UploadFile] = File(None),
):
    """
    Submits a distributed model training job to AWS SageMaker.
    If a local CSV is uploaded, it is automatically staged to S3.
    """
    s3_uri = dataset_s3_uri
    if file:
        content = await file.read()
        s3_uri = sagemaker_service.upload_dataset(file.filename or "dataset.csv", content)

    if not s3_uri:
        s3_uri = f"s3://{sagemaker_service.config.s3_bucket}/datasets/default.csv"

    job = sagemaker_service.launch_training_job(
        job_name=job_name,
        dataset_s3_uri=s3_uri,
        target_column=target_column,
        framework=framework,
        instance_type=instance_type,
    )
    return job.__dict__


@router.get("/jobs")
def list_sagemaker_jobs():
    """Lists all SageMaker training jobs executed via TarQ."""
    return sagemaker_service.list_jobs()


@router.get("/jobs/{job_name}")
def get_sagemaker_job(job_name: str):
    """Gets execution details, metrics, and logs for a SageMaker job."""
    job = sagemaker_service.get_job(job_name)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_name}' not found")
    return job


@router.post("/deploy")
def deploy_sagemaker_endpoint(payload: DeployEndpointPayload):
    """Deploys a model to a real-time AWS SageMaker inference endpoint."""
    try:
        ep = sagemaker_service.deploy_endpoint(
            endpoint_name=payload.endpoint_name,
            model_id=payload.model_id,
            instance_type=payload.instance_type,
        )
        return ep.__dict__
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/endpoints")
def list_sagemaker_endpoints():
    """Lists all active SageMaker real-time inference endpoints."""
    return sagemaker_service.list_endpoints()


@router.post("/endpoints/{endpoint_name}/predict")
def invoke_sagemaker_endpoint(endpoint_name: str, payload: InvokeEndpointPayload):
    """Sends real-time inference requests to a deployed SageMaker endpoint."""
    try:
        return sagemaker_service.invoke_endpoint(endpoint_name, payload.rows)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.delete("/endpoints/{endpoint_name}")
def delete_sagemaker_endpoint(endpoint_name: str):
    """Terminates a deployed SageMaker endpoint to cease cloud compute charges."""
    success = sagemaker_service.delete_endpoint(endpoint_name)
    if not success:
        raise HTTPException(status_code=404, detail=f"Endpoint '{endpoint_name}' not found")
    return {"status": "deleted", "endpoint_name": endpoint_name}


@router.get("/export/{model_id}")
def export_sagemaker_bundle(model_id: str):
    """Generates and downloads a SageMaker model.tar.gz container bundle with inference hooks."""
    try:
        bundle_path = sagemaker_service.export_sagemaker_bundle(model_id)
        return FileResponse(
            path=str(bundle_path),
            filename=f"sagemaker_{model_id}.tar.gz",
            media_type="application/gzip",
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
