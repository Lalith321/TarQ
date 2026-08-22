// services/dashboardMediaService.ts
export interface VideoItem {
  id: string;
  title: string;
  url: string;
  duration: number;
  uploadedAt: string;
}

export interface PresentationItem {
  id: string;
  title: string;
  slideCount: number;
  url: string;
  uploadedAt: string;
}

export interface UploadItem {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'icon';
  uploadedAt: string;
}

export const fetchDashboardMedia = async (dashboardId: string): Promise<{ videos: VideoItem[]; presentations: PresentationItem[] }> => {
  const res = await fetch(`/api/dashboards/${dashboardId}/media`);
  if (!res.ok) throw new Error('Failed to fetch media');
  return res.json();
};

export const fetchDashboardUploads = async (dashboardId: string): Promise<UploadItem[]> => {
  const res = await fetch(`/api/dashboards/${dashboardId}/uploads`);
  if (!res.ok) throw new Error('Failed to fetch uploads');
  return res.json();
};

export const uploadFile = async (dashboardId: string, file: File): Promise<UploadItem> => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`/api/dashboards/${dashboardId}/uploads`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error('Upload failed');
  return res.json();
};

export const deleteUpload = async (dashboardId: string, uploadId: string): Promise<void> => {
  const res = await fetch(`/api/dashboards/${dashboardId}/uploads/${uploadId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Delete failed');
};

export const deleteMedia = async (dashboardId: string, mediaId: string, type: 'video' | 'presentation'): Promise<void> => {
  const res = await fetch(`/api/dashboards/${dashboardId}/media/${type}/${mediaId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Delete failed');
};