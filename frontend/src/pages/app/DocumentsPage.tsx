import DocumentUpload from '@/features/documents/DocumentUpload';

export default function DocumentsPage() {
  return (
    <div className="space-y-6" style={{ color: 'var(--text-primary)' }}>
      <div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--accent)' }}>
          TarQ · Schemas
        </p>
        <h1 className="text-2xl font-bold tracking-tight">Schemas</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Manage schema sources used by your agents and dashboards.
        </p>
      </div>
      <DocumentUpload />
    </div>
  );
}