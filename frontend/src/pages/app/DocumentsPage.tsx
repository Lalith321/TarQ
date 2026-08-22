import DocumentUpload from '@/features/documents/DocumentUpload';
import DocumentInsights from '@/features/documents/DocumentInsights';

export default function DocumentsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
      <DocumentUpload />
      <DocumentInsights />
    </div>
  );
}