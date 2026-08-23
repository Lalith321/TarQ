import MlTrainingPanel from '@/features/ml/MlTrainingPanel';

export default function MlPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">ML Lab</h1>
      <MlTrainingPanel />
    </div>
  );
}