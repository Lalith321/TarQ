import { API_BASE_URL } from '@/lib/apiEndpoints';
import type { AnalystState, AgentEvent } from './types';

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

export interface SelectedAnalystSource {
  schema_id: string;
  tables: string[];
}

export interface AnalystChatRequest {
  selectedSources: SelectedAnalystSource[];
  fleetId?: string;
  dashboardId?: string;
  modelSettings: { provider: string; model: string; api_key: string };
}

export interface AnalystStreamControl {
  close: () => void;
  interrupt: () => void;
}

/**
 * Open a WebSocket to the LangGraph streaming endpoint and stream events.
 * Returns a cleanup function that closes the socket.
 *
 * @param sessionId  - thread_id for LangGraph checkpointer
 * @param message    - user message to send
 * @param onEvent    - called for every streamed event
 */
export function streamAnalystMessage(
  sessionId: string,
  message: string,
  request: AnalystChatRequest,
  onEvent: (event: AgentEvent) => void
): AnalystStreamControl {
  const ws = new WebSocket(`${WS_BASE_URL}/analyst/sessions/${sessionId}/ws`);
  let interruptRequested = false;

  ws.onopen = () => {
    ws.send(JSON.stringify({
      message,
      selected_sources: request.selectedSources,
      fleet_id: request.fleetId,
      dashboard_id: request.dashboardId,
      model_settings: request.modelSettings,
    }));
    if (interruptRequested) ws.send(JSON.stringify({ type: 'interrupt' }));
  };

  ws.onmessage = (e) => {
    try {
      const event: AgentEvent = JSON.parse(e.data);
      onEvent(event);
    } catch {
      // ignore malformed frames
    }
  };

  ws.onerror = () => {
    onEvent({ type: 'error', message: 'WebSocket connection error' });
  };

  return {
    interrupt: () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'interrupt' }));
      } else if (ws.readyState === WebSocket.CONNECTING) {
        interruptRequested = true;
      }
    },
    close: () => ws.close(),
  };
}
