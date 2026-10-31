from pathlib import Path
import pytest

from app.ml.sagemaker import sagemaker_service


def test_sagemaker_status_and_config():
    status = sagemaker_service.get_status()
    assert "mode" in status
    assert "region" in status

    new_cfg = sagemaker_service.update_config({
        "region_name": "eu-central-1",
        "simulation_mode": True,
    })
    assert new_cfg["region"] == "eu-central-1"
    assert new_cfg["simulation_mode"] is True


def test_sagemaker_dataset_upload():
    csv_bytes = b"feature1,feature2,target\n1,2,0\n3,4,1\n"
    s3_uri = sagemaker_service.upload_dataset("test.csv", csv_bytes)
    assert s3_uri.startswith("s3://")
    assert "test.csv" in s3_uri


def test_sagemaker_training_and_endpoint_lifecycle():
    job = sagemaker_service.launch_training_job(
        job_name="test-tarq-job",
        target_column="target",
        instance_type="ml.m5.large",
    )
    assert job.job_name == "test-tarq-job"
    assert job.status == "Completed"
    assert len(job.logs) > 0

    jobs = sagemaker_service.list_jobs()
    assert any(j["job_name"] == "test-tarq-job" for j in jobs)

    # Deploy endpoint
    ep = sagemaker_service.deploy_endpoint(
        endpoint_name="test-tarq-ep",
        model_id="test_model_123",
        instance_type="ml.m5.large",
    )
    assert ep.endpoint_name == "test-tarq-ep"
    assert ep.status == "InService"

    # Invoke endpoint
    inv = sagemaker_service.invoke_endpoint("test-tarq-ep", [{"feature1": 1, "feature2": 2}])
    assert "predictions" in inv
    assert "latency_ms" in inv
    assert len(inv["predictions"]) == 1

    # Delete endpoint
    deleted = sagemaker_service.delete_endpoint("test-tarq-ep")
    assert deleted is True


def test_sagemaker_export_bundle(tmp_path):
    bundle_path = sagemaker_service.export_sagemaker_bundle("sample_model_export")
    assert bundle_path.exists()
    assert bundle_path.name.endswith(".tar.gz")
