import MlTrainingPanel from '@/features/ml/MlTrainingPanel';

export default function MlPage() {
  return (
    <div className="space-y-6" style={{ color: 'var(--text-primary)' }}>
      <div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          TarQ · Machine Learning
        </p>
        <h1 className="text-2xl font-bold tracking-tight">ML Lab</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Upload a dataset, train with Optuna, and run predictions.
        </p>
      </div>
      <MlTrainingPanel />
    </div>
  );
}
