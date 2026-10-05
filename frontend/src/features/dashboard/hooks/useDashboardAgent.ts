import { useCallback, useEffect, useRef, useState } from 'react';
import { closeAnalystSession, createAnalystSession, streamAnalystMessage } from '@/services/analystService';
import type { AnalystStreamControl } from '@/services/analystService';
import type { SelectedAnalystSource } from '@/services/analystService';
import type { WidgetSpec } from '@/services/types';
import { readUserSettings } from '@/services/userSettings';

export interface AgentMessage {
  id: string; role: 'user' | 'agent' | 'system';
  content: string; timestamp: string;
  widget?: WidgetSpec; pending?: boolean;
}

interface UseDashboardAgentReturn {
  messages: AgentMessage[]; sending: boolean;
  sendMessage: (text: string) => void;
  stopMessage: () => void;
  appendWidget: (widget: WidgetSpec) => void;
  clearMessages: () => void;
}

function generateId() { return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`; }

export function useDashboardAgent(
  _sessionId: string,
  opts?: { onDashboardGenerated?: (widgets: WidgetSpec[]) => void; dashboardId?: string; existingWidgets?: WidgetSpec[]; selectedSources?: SelectedAnalystSource[]; fleetId?: string }
): UseDashboardAgentReturn {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [sending, setSending] = useState(false);
  const activeStreamRef = useRef<AnalystStreamControl | null>(null);
  const stopRequestedRef = useRef(false);
  // LangGraph thread_id — created lazily on first message
  const threadRef = useRef<string | null>(null);

  useEffect(() => () => {
    activeStreamRef.current?.interrupt();
    if (threadRef.current) void closeAnalystSession(threadRef.current);
  }, []);

  const sendMessage = useCallback((text: string) => {
    stopRequestedRef.current = false;
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

        const settings = readUserSettings();
        const control = streamAnalystMessage(sessionId, text, {
          selectedSources: opts?.selectedSources ?? [],
          fleetId: opts?.fleetId,
          modelSettings: {
            provider: settings.selectedProvider,
            model: settings.selectedModel,
            api_key: settings.keys[settings.selectedProvider],
          },
        }, (event) => {
          if (event.type === 'message_delta') {
            accumulated += event.content;
            setMessages((prev) =>
              prev.map((m) => m.id === pendingId ? { ...m, content: accumulated, pending: true } : m)
            );
          } else if (event.type === 'widget_created') {
            const widget = { ...event.widget, id: event.widget.id || event.widgetId };
            opts?.onDashboardGenerated?.([widget]);
            setMessages((prev) => [...prev, {
              id: generateId(), role: 'agent', content: `Created ${widget.title}.`,
              timestamp: new Date().toISOString(), widget,
            }]);
          } else if (event.type === 'final') {
            control.close();
            activeStreamRef.current = null;
            const finalText = event.content || accumulated;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === pendingId
                  ? { ...m, content: finalText, pending: false }
                  : m
              )
            );
            setSending(false);
            stopRequestedRef.current = false;
            resolve();
          } else if (event.type === 'interrupted') {
            control.close();
            activeStreamRef.current = null;
            setMessages((prev) =>
              prev.map((m) => m.id === pendingId
                ? { ...m, content: accumulated || 'Generation stopped.', pending: false }
                : m)
            );
            setSending(false);
            stopRequestedRef.current = false;
            resolve();
          } else if (event.type === 'error') {
            control.close();
            activeStreamRef.current = null;
            setMessages((prev) =>
              prev.map((m) => m.id === pendingId ? { ...m, pending: false, content: `Error: ${event.message}` } : m)
            );
            setSending(false);
            stopRequestedRef.current = false;
            resolve();
          }
        });
        activeStreamRef.current = control;
        if (stopRequestedRef.current) control.interrupt();
      });
    };

    run().catch((e) => {
      setMessages((prev) =>
        prev.map((m) => m.id === pendingId ? { ...m, pending: false, content: `Sorry, something went wrong: ${e.message}` } : m)
      );
      setSending(false);
      stopRequestedRef.current = false;
    });
  }, [opts]);

  const stopMessage = useCallback(() => {
    stopRequestedRef.current = true;
    activeStreamRef.current?.interrupt();
  }, []);

  const appendWidget = useCallback((widget: WidgetSpec) => {
    setMessages((prev) => [...prev, {
      id: generateId(), role: 'agent',
      content: `Added **${widget.title}** to the dashboard.`,
      timestamp: new Date().toISOString(), widget,
    }]);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return { messages, sending, sendMessage, stopMessage, appendWidget, clearMessages };
}
