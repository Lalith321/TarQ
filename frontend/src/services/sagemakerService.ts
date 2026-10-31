import { API_BASE_URL } from '@/lib/apiEndpoints';
import type {
  SageMakerConfig,
  SageMakerEndpoint,
  SageMakerJob,
  SageMakerStatus,
} from './types';

export async function getSageMakerStatus(): Promise<SageMakerStatus> {
  const res = await fetch(`${API_BASE_URL}/ml/sagemaker/status`);
  if (!res.ok) throw new Error(`Failed to get SageMaker status: ${res.status}`);
  return res.json();
}

export async function updateSageMakerConfig(config: SageMakerConfig): Promise<SageMakerStatus> {
  const res = await fetch(`${API_BASE_URL}/ml/sagemaker/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Failed to update SageMaker config: ${res.status}`);
  }
  return res.json();
}

export async function launchSageMakerTraining(
  targetColumn: string,
  opts: {
    jobName?: string;
    datasetS3Uri?: string;
    instanceType?: string;
    framework?: string;
    file?: File;
  } = {}
): Promise<SageMakerJob> {
  const form = new FormData();
  form.append('target_column', targetColumn);
  if (opts.jobName) form.append('job_name', opts.jobName);
  if (opts.datasetS3Uri) form.append('dataset_s3_uri', opts.datasetS3Uri);
  if (opts.instanceType) form.append('instance_type', opts.instanceType);
  if (opts.framework) form.append('framework', opts.framework);
  if (opts.file) form.append('file', opts.file);

  const res = await fetch(`${API_BASE_URL}/ml/sagemaker/train`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `SageMaker training submission failed: ${res.status}`);
  }
  return res.json();
}

export async function listSageMakerJobs(): Promise<SageMakerJob[]> {
  const res = await fetch(`${API_BASE_URL}/ml/sagemaker/jobs`);
  if (!res.ok) throw new Error(`Failed to list SageMaker jobs: ${res.status}`);
  return res.json();
}

export async function getSageMakerJob(jobName: string): Promise<SageMakerJob> {
  const res = await fetch(`${API_BASE_URL}/ml/sagemaker/jobs/${jobName}`);
  if (!res.ok) throw new Error(`Failed to load job details: ${res.status}`);
  return res.json();
}

export async function deploySageMakerEndpoint(
  endpointName: string,
  modelId: string,
  instanceType: string = 'ml.m5.large'
): Promise<SageMakerEndpoint> {
  const res = await fetch(`${API_BASE_URL}/ml/sagemaker/deploy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint_name: endpointName,
      model_id: modelId,
      instance_type: instanceType,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Endpoint deployment failed: ${res.status}`);
  }
  return res.json();
}

export async function listSageMakerEndpoints(): Promise<SageMakerEndpoint[]> {
  const res = await fetch(`${API_BASE_URL}/ml/sagemaker/endpoints`);
  if (!res.ok) throw new Error(`Failed to list SageMaker endpoints: ${res.status}`);
  return res.json();
}

export async function invokeSageMakerEndpoint(
  endpointName: string,
  rows: Record<string, any>[]
): Promise<{
  endpoint_name: string;
  predictions: any[];
  latency_ms: number;
  instance_type: string;
}> {
  const res = await fetch(`${API_BASE_URL}/ml/sagemaker/endpoints/${endpointName}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Endpoint invocation failed: ${res.status}`);
  }
  return res.json();
}

export async function deleteSageMakerEndpoint(endpointName: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/ml/sagemaker/endpoints/${endpointName}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Failed to delete endpoint: ${res.status}`);
}

export function getDownloadSageMakerBundleUrl(modelId: string): string {
  return `${API_BASE_URL}/ml/sagemaker/export/${modelId}`;
}
