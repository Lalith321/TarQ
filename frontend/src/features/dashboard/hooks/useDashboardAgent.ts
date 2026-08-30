import { useCallback, useRef, useState } from 'react';
import { createAnalystSession, streamAnalystMessage, fetchAnalystState } from '@/services/analystService';
import type { WidgetSpec } from '@/services/types';

export interface AgentMessage {
  id: string; role: 'user' | 'agent' | 'system';
  content: string; timestamp: string;
  widget?: WidgetSpec; pending?: boolean;
}

interface UseDashboardAgentReturn {
  messages: AgentMessage[]; sending: boolean;
  sendMessage: (text: string) => void;
  appendWidget: (widget: WidgetSpec) => void;
  clearMessages: () => void;
}

function generateId() { return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`; }

const SYSTEM_MSG: AgentMessage = {
  id: generateId(), role: 'system',
  content: 'Ask me anything about your data. I can build charts, tables, and maps — then place them on this dashboard.',
  timestamp: new Date().toISOString(),
};

export function useDashboardAgent(
  _sessionId: string,
  opts?: { onDashboardGenerated?: (widgets: WidgetSpec[]) => void; dashboardId?: string; existingWidgets?: WidgetSpec[] }
): UseDashboardAgentReturn {
  const [messages, setMessages] = useState<AgentMessage[]>([SYSTEM_MSG]);
  const [sending, setSending] = useState(false);
  // LangGraph thread_id — created lazily on first message
  const threadRef = useRef<string | null>(null);

  const sendMessage = useCallback((text: string) => {
    const userMsg: AgentMessage = { id: generateId(), role: 'user', content: text, timestamp: new Date().toISOString() };
    const pendingId = generateId();
    const pendingMsg: AgentMessage = { id: pendingId, role: 'agent', content: '', timestamp: new Date().toISOString(), pending: true };
    setMessages((prev) => [...prev, userMsg, pendingMsg]);
    setSending(true);

    const run = async () => {
      // Lazily create a LangGraph session (thread_id) once per hook instance
      if (!threadRef.current) {
        threadRef.current = await createAnalystSession();
      }
      const sessionId = threadRef.current;

      return new Promise<void>((resolve) => {
        let accumulated = '';

        const cleanup = streamAnalystMessage(sessionId, text, async (event) => {
          if (event.type === 'token') {
            accumulated += event.content;
            setMessages((prev) =>
              prev.map((m) => m.id === pendingId ? { ...m, content: accumulated, pending: true } : m)
            );
          } else if (event.type === 'done') {
            cleanup();
            // Fetch final state to get widgets produced by dashboard_tool
            try {
              const state = await fetchAnalystState(sessionId);
              if (state.widgets.length > 0) {
                setMessages((prev) => prev.filter((m) => m.id !== pendingId));
                opts?.onDashboardGenerated?.(state.widgets as WidgetSpec[]);
              } else {
                setMessages((prev) =>
                  prev.map((m) => m.id === pendingId ? { ...m, content: accumulated, pending: false } : m)
                );
              }
            } catch {
              setMessages((prev) =>
                prev.map((m) => m.id === pendingId ? { ...m, content: accumulated, pending: false } : m)
              );
            }
            setSending(false);
            resolve();
          } else if (event.type === 'error') {
            cleanup();
            setMessages((prev) =>
              prev.map((m) => m.id === pendingId ? { ...m, pending: false, content: `Error: ${event.error}` } : m)
            );
            setSending(false);
            resolve();
          }
        });
      });
    };

    run().catch((e) => {
      setMessages((prev) =>
        prev.map((m) => m.id === pendingId ? { ...m, pending: false, content: `Sorry, something went wrong: ${e.message}` } : m)
      );
      setSending(false);
    });
  }, [opts]);

  const appendWidget = useCallback((widget: WidgetSpec) => {
    setMessages((prev) => [...prev, {
      id: generateId(), role: 'agent',
      content: `Added **${widget.title}** to the dashboard.`,
      timestamp: new Date().toISOString(), widget,
    }]);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([{ ...SYSTEM_MSG, id: generateId(), timestamp: new Date().toISOString() }]);
  }, []);

  return { messages, sending, sendMessage, appendWidget, clearMessages };
}
