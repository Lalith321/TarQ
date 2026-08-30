import { API_BASE_URL } from '@/lib/apiEndpoints';
import type { InsightBundle } from './types';

export async function uploadDocumentForInsights(file: File): Promise<InsightBundle> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE_URL}/documents/upload`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error(`upload failed: ${res.status}`);
  return res.json();
}
