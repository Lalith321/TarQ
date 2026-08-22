import { API_BASE_URL } from '@/lib/apiEndpoints';
import type { ModelListEntry, TrainingResult } from './types';

export async function trainModel(
  file: File,
  target: string,
  opts: { task?: string; nTrials?: number } = {}
): Promise<TrainingResult> {
  const form = new FormData();
  form.append('file', file);
  form.append('target', target);
  if (opts.task) form.append('task', opts.task);
  if (opts.nTrials) form.append('n_trials', String(opts.nTrials));

  const res = await fetch(`${API_BASE_URL}/ml/train`, { method: 'POST', body: form });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `training failed: ${res.status}`);
  }
  return res.json();
}

export async function listModels(): Promise<ModelListEntry[]> {
  const res = await fetch(`${API_BASE_URL}/ml/models`);
  if (!res.ok) throw new Error(`listModels failed: ${res.status}`);
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
    throw new Error(body.detail || `predict failed: ${res.status}`);
  }
  const data = await res.json();
  return data.predictions;
}
