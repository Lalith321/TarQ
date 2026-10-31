import { API_BASE_URL } from '@/lib/apiEndpoints';
import type {
  ModelListEntry,
  TimeSeriesResult,
  TrainingResult,
} from './types';

export async function trainModel(
  file: File,
  target: string,
  opts: {
    task?: string;
    nTrials?: number;
    cv?: number;
    families?: string[];
  } = {}
): Promise<TrainingResult> {
  const form = new FormData();
  form.append('file', file);
  form.append('target', target);
  if (opts.task) form.append('task', opts.task);
  if (opts.nTrials) form.append('n_trials', String(opts.nTrials));
  if (opts.cv) form.append('cv', String(opts.cv));
  if (opts.families && opts.families.length > 0) {
    form.append('families', opts.families.join(','));
  }

  const res = await fetch(`${API_BASE_URL}/ml/train`, { method: 'POST', body: form });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Training failed with status: ${res.status}`);
  }
  return res.json();
}

export async function listModels(): Promise<ModelListEntry[]> {
  const res = await fetch(`${API_BASE_URL}/ml/models`);
  if (!res.ok) throw new Error(`Failed to list models: ${res.status}`);
  return res.json();
}

export async function getModelDetails(modelId: string): Promise<TrainingResult> {
  const res = await fetch(`${API_BASE_URL}/ml/models/${modelId}`);
  if (!res.ok) throw new Error(`Failed to load model details: ${res.status}`);
  return res.json();
}

export async function predict(modelId: string, rows: Record<string, any>[]): Promise<any[]> {
  const res = await fetch(`${API_BASE_URL}/ml/models/${modelId}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Prediction failed: ${res.status}`);
  }
  const data = await res.json();
  return data.predictions;
}

export async function batchPredict(modelId: string, file: File): Promise<Blob> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE_URL}/ml/models/${modelId}/batch-predict`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Batch prediction failed: ${res.status}`);
  }
  return res.blob();
}

export async function explainPrediction(modelId: string, row: Record<string, any>): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/ml/models/${modelId}/explain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ row }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Explanation failed: ${res.status}`);
  }
  return res.json();
}

export function getDownloadModelUrl(modelId: string): string {
  return `${API_BASE_URL}/ml/models/${modelId}/download`;
}

export async function deleteModel(modelId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/ml/models/${modelId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
}

// ── Time Series Forecasting ────────────────────────────────────────────────

export async function trainTimeSeries(
  file: File,
  targetColumn: string,
  opts: {
    architecture?: string;
    lookback?: number;
    horizon?: number;
    scaler?: string;
    epochs?: number;
    timeColumn?: string;
  } = {}
): Promise<TimeSeriesResult> {
  const form = new FormData();
  form.append('file', file);
  form.append('target_column', targetColumn);
  if (opts.architecture) form.append('architecture', opts.architecture);
  if (opts.lookback) form.append('lookback', String(opts.lookback));
  if (opts.horizon) form.append('horizon', String(opts.horizon));
  if (opts.scaler) form.append('scaler', opts.scaler);
  if (opts.epochs) form.append('epochs', String(opts.epochs));
  if (opts.timeColumn) form.append('time_column', opts.timeColumn);

  const res = await fetch(`${API_BASE_URL}/ml/timeseries/train`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Time series training failed: ${res.status}`);
  }
  return res.json();
}

export async function listTimeSeriesModels(): Promise<TimeSeriesResult[]> {
  const res = await fetch(`${API_BASE_URL}/ml/timeseries/models`);
  if (!res.ok) throw new Error(`Failed to list time series models: ${res.status}`);
  return res.json();
}

export async function getTimeSeriesModel(modelId: string): Promise<TimeSeriesResult> {
  const res = await fetch(`${API_BASE_URL}/ml/timeseries/models/${modelId}`);
  if (!res.ok) throw new Error(`Failed to load time series model: ${res.status}`);
  return res.json();
}
