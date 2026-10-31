import { API_BASE_URL } from '@/lib/apiEndpoints';

export interface GeneratedArtifact {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  dashboard_id?: string | null;
}

export interface DashboardInputFile {
  id: string;
  name: string;
  type: 'pdf' | 'csv' | 'json' | 'image';
  size: number;
  url: string;
  dashboard_id: string;
  uploadedAt: string;
}

export async function fetchGeneratedArtifacts(dashboardId?: string): Promise<GeneratedArtifact[]> {
  const query = dashboardId ? `?dashboard_id=${encodeURIComponent(dashboardId)}` : '';
  const response = await fetch(`${API_BASE_URL}/artifacts/${query}`);
  if (!response.ok) throw new Error(`fetchGeneratedArtifacts failed: ${response.status}`);
  return response.json();
}

export async function deleteGeneratedArtifact(artifactId: string, dashboardId?: string): Promise<void> {
  const query = dashboardId ? `?dashboard_id=${encodeURIComponent(dashboardId)}` : '';
  const response = await fetch(`${API_BASE_URL}/artifacts/${encodeURIComponent(artifactId)}${query}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error(`deleteGeneratedArtifact failed: ${response.status}`);
}

export async function fetchDashboardInputs(dashboardId: string): Promise<DashboardInputFile[]> {
  const response = await fetch(`${API_BASE_URL}/artifacts/inputs?dashboard_id=${encodeURIComponent(dashboardId)}`);
  if (!response.ok) throw new Error(`fetchDashboardInputs failed: ${response.status}`);
  return response.json();
}

export async function uploadDashboardInput(dashboardId: string, file: File): Promise<DashboardInputFile> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(
    `${API_BASE_URL}/artifacts/inputs?dashboard_id=${encodeURIComponent(dashboardId)}`,
    {
      method: 'POST',
      body: formData,
    }
  );
  if (!response.ok) throw new Error(`uploadDashboardInput failed: ${response.status}`);
  return response.json();
}

export async function deleteDashboardInput(inputId: string, dashboardId: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/artifacts/inputs/${encodeURIComponent(inputId)}?dashboard_id=${encodeURIComponent(dashboardId)}`,
    {
      method: 'DELETE',
    }
  );
  if (!response.ok) throw new Error(`deleteDashboardInput failed: ${response.status}`);
}