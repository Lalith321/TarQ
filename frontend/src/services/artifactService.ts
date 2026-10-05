import { API_BASE_URL } from '@/lib/apiEndpoints';

export interface GeneratedArtifact {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
}

export async function fetchGeneratedArtifacts(): Promise<GeneratedArtifact[]> {
  const response = await fetch(`${API_BASE_URL}/artifacts/`);
  if (!response.ok) throw new Error(`fetchGeneratedArtifacts failed: ${response.status}`);
  return response.json();
}