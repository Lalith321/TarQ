// services/dataSourceService.ts
import { API_BASE_URL } from '@/lib/apiEndpoints';

export interface DataSource {
  id: string;
  type: 'structured' | 'document';
  name: string;
  subtype: string;
  sourceType?: string;
  tables?: string[];
  status: 'connected' | 'ready' | 'streaming' | 'indexed' | 'failed' | 'processing';
  meta: string;
  detail: string;
  size?: string;
}

export interface SQLConnectionPayload {
  dbType: string;
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
}

export interface SQLTestResult {
  success: boolean;
  schemas: string[];
  tables: string[];
}

export interface ExcelUploadResult {
  sheets: string[];
  preview: any[][];
  columns: { name: string; type: string }[];
}

export interface WebSocketTestResult {
  success: boolean;
  schema: { column: string; type: string }[];
}

export const normalizeDataSource = (raw: any): DataSource => {
  const name = raw?.name || 'Unnamed schema';
  const status = String(raw?.status || 'connected');
  const metadata = raw?.metadata || {};
  const tables = Array.isArray(raw?.tables) ? raw.tables : [];

  const mappedStatus: DataSource['status'] =
    status === 'connected' || status === 'ready' || status === 'failed' ? status :
    status === 'importing' || status === 'processing' ? 'processing' :
    'connected';
  const sourceType = raw?.source_type ?? raw?.sourceType;

  const subtype =
    raw?.subtype ||
    (sourceType === 'remote_sql' ? 'PostgreSQL' : sourceType === 'excel' ? 'Excel' : metadata.file_type || 'Document');

  return {
    id: String(raw?.id ?? `schema_${Date.now()}`),
    type: sourceType === 'document' ? 'document' : 'structured',
    name,
    subtype,
    sourceType,
    tables: tables.map((table: any) => String(table?.name ?? table)).filter(Boolean),
    status: mappedStatus,
    meta: metadata.database || metadata.host || metadata.summary || `${tables.length} table${tables.length === 1 ? '' : 's'}`,
    detail: metadata.chunk_count ? `${metadata.chunk_count} chunks analyzed` : tables.length ? `${tables.length} table${tables.length === 1 ? '' : 's'}` : 'No tables selected',
    size: raw?.size || metadata.file_size,
  };
};

export const fetchDataSources = async (): Promise<DataSource[]> => {
  const res = await fetch(`${API_BASE_URL}/schemas/`);
  if (!res.ok) throw new Error('Failed to fetch data sources');
  const body = await res.json().catch(() => []);
  return Array.isArray(body) ? body.map(normalizeDataSource) : [];
};

export const testSQLConnection = async (payload: SQLConnectionPayload): Promise<SQLTestResult> => {
  const res = await fetch(`${API_BASE_URL}/schemas/test-connection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) {
    throw new Error(body.error || 'Connection failed');
  }
  return body;
};

export const importSQLSchema = async (payload: SQLConnectionPayload & { tables: string[] }): Promise<DataSource> => {
  const schemaPayload = {
    id: `schema_${Date.now()}`,
    name: payload.database || 'New schema',
    source_type: 'remote_sql',
    status: 'connected',
    owner: 'demo-user',
    metadata: {
      dbType: payload.dbType,
      host: payload.host,
      port: payload.port,
      database: payload.database,
      username: payload.username,
      ssl: payload.ssl,
      password: payload.password,
    },
    tables: (payload.tables || []).map((tableName) => ({
      name: tableName,
      columns: [],
      metadata: {},
    })),
  };

  const res = await fetch(`${API_BASE_URL}/schemas/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(schemaPayload),
  });
  if (!res.ok) throw new Error('Import failed');
  const body = await res.json().catch(() => ({}));
  return normalizeDataSource(body);
};

export const uploadDocument = async (file: File): Promise<DataSource> => {
  const formData = new FormData();
  formData.append('file', file);
  const extractResponse = await fetch(`${API_BASE_URL}/documents/upload`, { method: 'POST', body: formData });
  const insights = await extractResponse.json().catch(() => ({}));
  if (!extractResponse.ok) {
    throw new Error(insights.detail || `Document extraction failed (${extractResponse.status})`);
  }

  const extension = file.name.split('.').pop()?.toUpperCase() || 'Document';
  const schemaPayload = {
    id: `document_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: insights.source_file || file.name,
    source_type: 'document',
    status: 'ready',
    owner: 'local-user',
    metadata: {
      file_type: extension,
      file_size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
      summary: insights.summary || '',
      entities: insights.entities || [],
      metrics: insights.metrics || [],
      action_items: insights.action_items || [],
      risks: insights.risks || [],
      chunk_count: insights.chunk_count || 0,
      low_confidence: Boolean(insights.low_confidence),
    },
    tables: [],
  };
  const saveResponse = await fetch(`${API_BASE_URL}/schemas/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(schemaPayload),
  });
  const savedSchema = await saveResponse.json().catch(() => ({}));
  if (!saveResponse.ok) {
    throw new Error(savedSchema.detail || `Could not save extracted document (${saveResponse.status})`);
  }
  return normalizeDataSource(savedSchema);
};

export const uploadExcelFile = async (file: File): Promise<ExcelUploadResult> => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch('/api/data-sources/upload-excel', {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error('Upload failed');
  return res.json();
};

export const importExcelDataset = async (payload: { fileName: string; sheets: string[]; columns: any[] }): Promise<DataSource> => {
  const res = await fetch('/api/data-sources/import-excel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Import failed');
  return res.json();
};

export const testWebSocket = async (payload: { type: string; endpoint: string; auth: string; format: string }): Promise<WebSocketTestResult> => {
  const res = await fetch('/api/data-sources/test-websocket', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Connection failed');
  return res.json();
};

export const saveWebSocketConnection = async (payload: { type: string; endpoint: string; auth: string; format: string }): Promise<DataSource> => {
  const res = await fetch('/api/data-sources/websocket', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Save failed');
  return res.json();
};

export const uploadDocuments = async (files: FileList): Promise<{ id: string; name: string; pages: number; size: string }[]> => {
  const formData = new FormData();
  Array.from(files).forEach((f) => formData.append('files', f));
  const res = await fetch('/api/data-sources/upload-documents', {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error('Upload failed');
  return res.json();
};

export const deleteDataSource = async (id: string): Promise<void> => {
  const res = await fetch(`${API_BASE_URL}/schemas/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Delete failed');
};