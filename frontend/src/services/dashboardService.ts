import { API_BASE_URL } from '@/lib/apiEndpoints';
import type { DashboardSpec, WidgetSpec } from './types';

// No auth headers here by design — see PLAN.md. When auth lands, this is
// the one place to add an Authorization header / credentials: 'include'.

export async function listDashboards(): Promise<DashboardSpec[]> {
  const res = await fetch(`${API_BASE_URL}/dashboards/`);
  if (!res.ok) throw new Error(`listDashboards failed: ${res.status}`);
  return res.json();
}

export async function createDashboard(spec: {
  id: string;
  title: string;
  description?: string;
}): Promise<DashboardSpec> {
  const res = await fetch(`${API_BASE_URL}/dashboards/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...spec, description: spec.description ?? '', widgets: [] }),
  });
  if (!res.ok) throw new Error(`createDashboard failed: ${res.status}`);
  return res.json();
}

export async function fetchDashboard(dashboardId: string): Promise<DashboardSpec> {
  const res = await fetch(`${API_BASE_URL}/dashboards/${dashboardId}`);
  if (!res.ok) throw new Error(`fetchDashboard failed: ${res.status}`);
  return res.json();
}

export async function fetchDrillDown(
  dashboardId: string,
  widgetId: string,
  clickedRow: Record<string, any>
): Promise<WidgetSpec> {
  const res = await fetch(
    `${API_BASE_URL}/dashboards/${dashboardId}/widgets/${widgetId}/drilldown`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(clickedRow),
    }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `drilldown failed: ${res.status}`);
  }
  return res.json();
}

export async function deleteDashboard(dashboardId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/dashboards/${dashboardId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`deleteDashboard failed: ${res.status}`);
}

export async function updateDashboard(
  dashboardId: string,
  updates: Partial<DashboardSpec>
): Promise<DashboardSpec> {
  const res = await fetch(`${API_BASE_URL}/dashboards/${dashboardId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(`updateDashboard failed: ${res.status}`);
  return res.json();
}
