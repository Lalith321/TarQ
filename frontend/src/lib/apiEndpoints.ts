export const API_BASE_URL =
  (typeof window !== 'undefined' && (window as any).__API_BASE_URL__) ||
  'http://localhost:8000';
