// services/dataSourceService.ts
export interface DataSource {
  id: string;
  type: 'structured' | 'live' | 'document';
  name: string;
  subtype: string;
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

export const fetchDataSources = async (): Promise<DataSource[]> => {
  const res = await fetch('/api/data-sources');
  if (!res.ok) throw new Error('Failed to fetch data sources');
  return res.json();
};

export const testSQLConnection = async (payload: SQLConnectionPayload): Promise<SQLTestResult> => {
  const res = await fetch('/api/data-sources/test-connection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Connection failed');
  return res.json();
};

export const importSQLSchema = async (payload: SQLConnectionPayload & { tables: string[] }): Promise<DataSource> => {
  const res = await fetch('/api/data-sources/sql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Import failed');
  return res.json();
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
  const res = await fetch(`/api/data-sources/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Delete failed');
};