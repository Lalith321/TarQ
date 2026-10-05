import { DashboardList } from '@/features/dashboard';

export default function DashboardPage() {
  return (
    <div className="space-y-6" style={{ color: 'var(--text-primary)' }}>
      <div className="flex items-end justify-between">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
            TarQ · Overview
          </p>
          <h1 className="text-2xl font-bold tracking-tight">Dashboards</h1>
        </div>
      </div>
      <DashboardList />
    </div>
  );
}
