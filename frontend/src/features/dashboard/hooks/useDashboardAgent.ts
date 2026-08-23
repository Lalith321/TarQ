import { useCallback, useState } from 'react';
import { sendAgentMessage } from '@/services/dashboardService';
import type { WidgetSpec } from '@/services/types';

export interface AgentMessage {
  id: string; role: 'user' | 'agent' | 'system';
  content: string; timestamp: string;
  widget?: WidgetSpec; pending?: boolean;
}

interface UseDashboardAgentReturn {
  messages: AgentMessage[]; sending: boolean;
  sendMessage: (text: string) => Promise<void>;
  appendWidget: (widget: WidgetSpec) => void;
  clearMessages: () => void;
}

function generateId() { return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`; }

export function useDashboardAgent(sessionId: string, opts?: { onDashboardGenerated?: (widgets: WidgetSpec[]) => void; dashboardId?: string; existingWidgets?: WidgetSpec[] }): UseDashboardAgentReturn {
  const [messages, setMessages] = useState<AgentMessage[]>([{ id: generateId(), role: 'system', content: 'Ask me anything about your data. I can build charts, tables, and maps — then place them on this dashboard.', timestamp: new Date().toISOString() }]);
  const [sending, setSending] = useState(false);

  const sendMessage = useCallback(async (text: string) => {
    const userMsg: AgentMessage = { id: generateId(), role: 'user', content: text, timestamp: new Date().toISOString() };
    const pendingMsg: AgentMessage = { id: generateId(), role: 'agent', content: '', timestamp: new Date().toISOString(), pending: true };
    setMessages((prev) => [...prev, userMsg, pendingMsg]); setSending(true);

    try {
      const result = await sendAgentMessage(sessionId, text, { dashboardId: opts?.dashboardId, existingWidgets: opts?.existingWidgets });
      if (result.kind === 'dashboard') {
        setMessages((prev) => prev.filter((m) => m.id !== pendingMsg.id));
        opts?.onDashboardGenerated?.(result.widgets);
      } else {
        const agentMsg: AgentMessage = {
          id: pendingMsg.id,
          role: 'agent',
          content: result.reply,
          timestamp: new Date().toISOString(),
          widget: result.kind === 'widget' ? result.widget : undefined,
        };
        setMessages((prev) => prev.map((m) => (m.id === pendingMsg.id ? agentMsg : m)));
      }
    } catch (e: any) {
      setMessages((prev) => prev.map((m) => (m.id === pendingMsg.id ? { ...pendingMsg, pending: false, content: `Sorry, something went wrong: ${e.message}` } : m)));
    } finally { setSending(false); }
  }, [sessionId, opts]);

  const appendWidget = useCallback((widget: WidgetSpec) => {
    setMessages((prev) => [...prev, { id: generateId(), role: 'agent', content: `Added **${widget.title}** to the dashboard.`, timestamp: new Date().toISOString(), widget }]);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([{ id: generateId(), role: 'system', content: 'Ask me anything about your data. I can build charts, tables, and maps — then place them on this dashboard.', timestamp: new Date().toISOString() }]);
  }, []);

  return { messages, sending, sendMessage, appendWidget, clearMessages };
}
