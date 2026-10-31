"""
SageMaker Tool — exposes AWS SageMaker training, endpoint deployment, and inference
as an agentic tool for the TarQ Analyst and Coordinator fleet.
"""
import json
from typing import Annotated, Optional
from langchain_core.tools import tool

from app.ml.sagemaker import sagemaker_service


@tool
def manage_sagemaker_endpoint(
    action: Annotated[str, "'status', 'list_jobs', 'list_endpoints', 'launch_training', 'deploy_endpoint', 'invoke_endpoint'"],
    endpoint_name: Annotated[Optional[str], "Name of the SageMaker endpoint to deploy, invoke, or check."] = None,
    model_id: Annotated[Optional[str], "Registered TarQ model ID to deploy."] = None,
    payload_json: Annotated[Optional[str], "JSON string containing rows to predict when action is 'invoke_endpoint'."] = None,
    target_column: Annotated[Optional[str], "Target column to train on when action is 'launch_training'."] = None,
    instance_type: Annotated[str, "AWS instance type (e.g. 'ml.m5.large', 'ml.m5.xlarge')."] = "ml.m5.large",
) -> str:
    """
    Manage AWS SageMaker training jobs and real-time inference endpoints.
    Can check AWS connection status, submit distributed training, deploy models,
    and invoke cloud endpoints for low-latency predictions.
    """
    try:
        if action == "status":
            return json.dumps(sagemaker_service.get_status())
        elif action == "list_jobs":
            return json.dumps(sagemaker_service.list_jobs())
        elif action == "list_endpoints":
            return json.dumps(sagemaker_service.list_endpoints())
        elif action == "launch_training":
            job = sagemaker_service.launch_training_job(
                target_column=target_column or "target",
                instance_type=instance_type,
            )
            return json.dumps({"ok": True, "job": job.__dict__})
        elif action == "deploy_endpoint":
            if not endpoint_name or not model_id:
                return json.dumps({"error": "endpoint_name and model_id are required to deploy an endpoint"})
            ep = sagemaker_service.deploy_endpoint(
                endpoint_name=endpoint_name,
                model_id=model_id,
                instance_type=instance_type,
            )
            return json.dumps({"ok": True, "endpoint": ep.__dict__})
        elif action == "invoke_endpoint":
            if not endpoint_name:
                return json.dumps({"error": "endpoint_name is required"})
            rows = json.loads(payload_json or "[]")
            if isinstance(rows, dict):
                rows = [rows]
            res = sagemaker_service.invoke_endpoint(endpoint_name, rows)
            return json.dumps({"ok": True, **res})
        else:
            return json.dumps({"error": f"Unknown action: {action}"})
    except Exception as exc:
        return json.dumps({"error": str(exc)})
