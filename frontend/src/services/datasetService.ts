import { API_BASE_URL } from '@/lib/apiEndpoints';
import type { DatasetProfile, SampleDataset } from './types';

export async function profileDataset(file: File): Promise<DatasetProfile> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE_URL}/datasets/profile`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Dataset profiling failed: ${res.status}`);
  }
  return res.json();
}

export async function getSampleDataset(
  type: 'classification' | 'regression' | 'timeseries' = 'classification'
): Promise<SampleDataset> {
  const res = await fetch(`${API_BASE_URL}/datasets/sample?dataset_type=${type}`);
  if (!res.ok) throw new Error(`Failed to load sample dataset: ${res.status}`);
  return res.json();
}
