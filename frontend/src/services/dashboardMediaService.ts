import { API_BASE_URL } from '@/lib/apiEndpoints';

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
  type: 'image' | 'icon' | 'pdf' | 'csv' | 'json';
  uploadedAt: string;
}

export const fetchDashboardMedia = async (dashboardId: string): Promise<{ videos: VideoItem[]; presentations: PresentationItem[] }> => {
  const res = await fetch(`${API_BASE_URL}/dashboards/${encodeURIComponent(dashboardId)}/media`);
  if (!res.ok) throw new Error('Failed to fetch media');
  const items = await res.json();
  const videos: VideoItem[] = [];
  const presentations: PresentationItem[] = [];
  for (const item of Array.isArray(items) ? items : []) {
    const fullUrl = item.url?.startsWith('http') ? item.url : `${API_BASE_URL}${item.url}`;
    if (item.type === 'video') {
      videos.push({
        id: item.id,
        title: item.name,
        url: fullUrl,
        duration: 0,
        uploadedAt: new Date().toISOString(),
      });
    } else if (item.type === 'ppt') {
      presentations.push({
        id: item.id,
        title: item.name,
        slideCount: 0,
        url: fullUrl,
        uploadedAt: new Date().toISOString(),
      });
    }
  }
  return { videos, presentations };
};

export const fetchDashboardUploads = async (dashboardId: string): Promise<UploadItem[]> => {
  const res = await fetch(`${API_BASE_URL}/dashboards/${encodeURIComponent(dashboardId)}/uploads`);
  if (!res.ok) throw new Error('Failed to fetch uploads');
  return res.json();
};

export const uploadFile = async (dashboardId: string, file: File): Promise<UploadItem> => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE_URL}/dashboards/${encodeURIComponent(dashboardId)}/uploads`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error('Upload failed');
  return res.json();
};

export const deleteUpload = async (dashboardId: string, uploadId: string): Promise<void> => {
  const res = await fetch(`${API_BASE_URL}/dashboards/${encodeURIComponent(dashboardId)}/uploads/${encodeURIComponent(uploadId)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Delete failed');
};

export const deleteMedia = async (dashboardId: string, mediaId: string, _type?: 'video' | 'presentation'): Promise<void> => {
  const res = await fetch(`${API_BASE_URL}/dashboards/${encodeURIComponent(dashboardId)}/media/${encodeURIComponent(mediaId)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Delete failed');
};