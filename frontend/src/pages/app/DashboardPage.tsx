import { DashboardList } from '@/features/dashboard';

export default function DashboardPage() {
  return (
    <div className="space-y-6" style={{ color: 'var(--text-primary)' }}>
      <div className="flex items-end justify-between">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--accent)' }}>
            TarQ · Overview
          </p>
          <h1 className="text-2xl font-bold tracking-tight">Dashboards</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Build and explore your analytics dashboards.
          </p>
        </div>
      </div>
      <DashboardList />
    </div>
  );
}
