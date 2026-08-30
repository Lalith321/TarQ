import { API_BASE_URL } from '@/lib/apiEndpoints';
import type { AnalystState, AnalystStreamEvent } from './types';

const WS_BASE_URL = API_BASE_URL.replace(/^http/, 'ws');

export async function createAnalystSession(): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/analyst/sessions`, { method: 'POST' });
  if (!res.ok) throw new Error(`createAnalystSession failed: ${res.status}`);
  return (await res.json()).session_id;
}

export async function fetchAnalystState(sessionId: string): Promise<AnalystState> {
  const res = await fetch(`${API_BASE_URL}/analyst/sessions/${sessionId}/state`);
  if (!res.ok) throw new Error(`fetchAnalystState failed: ${res.status}`);
  return res.json();
}

export async function closeAnalystSession(sessionId: string): Promise<void> {
  await fetch(`${API_BASE_URL}/analyst/sessions/${sessionId}`, { method: 'DELETE' });
}

/**
 * Open a WebSocket to the LangGraph streaming endpoint and stream events.
 * Returns a cleanup function that closes the socket.
 *
 * @param sessionId  - thread_id for LangGraph checkpointer
 * @param message    - user message to send
 * @param onEvent    - called for every streamed event (token, node_start, tool_start, tool_end, done, error)
 */
export function streamAnalystMessage(
  sessionId: string,
  message: string,
  onEvent: (event: AnalystStreamEvent) => void
): () => void {
  const ws = new WebSocket(`${WS_BASE_URL}/analyst/sessions/${sessionId}/ws`);

  ws.onopen = () => {
    ws.send(JSON.stringify({ message }));
  };

  ws.onmessage = (e) => {
    try {
      const event: AnalystStreamEvent = JSON.parse(e.data);
      onEvent(event);
    } catch {
      // ignore malformed frames
    }
  };

  ws.onerror = () => {
    onEvent({ type: 'error', error: 'WebSocket connection error' });
  };

  return () => ws.close();
}
