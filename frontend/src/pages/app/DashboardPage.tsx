import { DashboardList } from '@/features/dashboard';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Dashboards</h1>
      </div>
      <DashboardList />
    </div>
  );
}