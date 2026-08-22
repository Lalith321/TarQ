import { API_BASE_URL } from '@/lib/apiEndpoints';
import type { AnalystMessageResult, AnalystState } from './types';

/**
 * This is the actual integration surface for wiring an existing chat UI to
 * the deep data analyst agent — createSession() once, then sendMessage()
 * per turn, same shape as any other chat backend call. No new chat/message
 * list component is built here on purpose; that already exists elsewhere.
 * getState() is the one piece worth a dedicated panel (see
 * AnalystStatePanel.tsx) since it's sandbox/dataframe/plan state a generic
 * chat UI has no reason to already render.
 */

export async function createAnalystSession(): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/analyst/sessions`, { method: 'POST' });
  if (!res.ok) throw new Error(`createAnalystSession failed: ${res.status}`);
  return (await res.json()).session_id;
}

export async function uploadAnalystDataset(sessionId: string, file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE_URL}/analyst/sessions/${sessionId}/upload`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error(`uploadAnalystDataset failed: ${res.status}`);
  return (await res.json()).path;
}

export async function sendAnalystMessage(
  sessionId: string,
  message: string,
  hints?: Record<string, any>
): Promise<AnalystMessageResult> {
  const res = await fetch(`${API_BASE_URL}/analyst/sessions/${sessionId}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, hints }),
  });
  if (!res.ok) throw new Error(`sendAnalystMessage failed: ${res.status}`);
  return res.json();
}

export async function fetchAnalystState(sessionId: string): Promise<AnalystState> {
  const res = await fetch(`${API_BASE_URL}/analyst/sessions/${sessionId}/state`);
  if (!res.ok) throw new Error(`fetchAnalystState failed: ${res.status}`);
  return res.json();
}

export async function closeAnalystSession(sessionId: string): Promise<void> {
  await fetch(`${API_BASE_URL}/analyst/sessions/${sessionId}`, { method: 'DELETE' });
}
