import { useCallback, useEffect, useState } from 'react';
import { listDashboards, createDashboard, deleteDashboard } from '@/services/dashboardService';
import type { DashboardSpec } from '@/services/types';

interface UseDashboardsReturn {
  dashboards: DashboardSpec[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  create: (spec: { title: string; description?: string }) => Promise<DashboardSpec>;
  remove: (id: string) => Promise<void>;
}

/** Backend sometimes omits `widgets` — always normalize to [] */
function normalizeDashboard(d: DashboardSpec): DashboardSpec {
  return { ...d, widgets: d.widgets ?? [] };
}

export function useDashboards(): UseDashboardsReturn {
  const [dashboards, setDashboards] = useState<DashboardSpec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    listDashboards()
      .then((data) => setDashboards(data.map(normalizeDashboard)))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    async (spec: { title: string; description?: string }) => {
      const id = `dash_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const created = await createDashboard({ id, ...spec });
      setDashboards((prev) => [...prev, normalizeDashboard(created)]);
      return created;
    },
    []
  );

  const remove = useCallback(async (id: string) => {
    await deleteDashboard(id);
    setDashboards((prev) => prev.filter((d) => d.id !== id));
  }, []);

  return { dashboards, loading, error, refresh, create, remove };
}