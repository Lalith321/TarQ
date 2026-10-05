import { useRef, useEffect, useState } from 'react';
import { Square } from 'lucide-react';
import type { AgentMessage } from '../hooks/useDashboardAgent';
import WidgetRenderer from './widgets/WidgetRenderer';

interface Props {
  messages: AgentMessage[];
  sending: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  onAddWidgetFromChat?: (widget: NonNullable<AgentMessage['widget']>) => void;
}

export function ChatPanel({ messages, sending, onSend, onStop, onAddWidgetFromChat }: Props) {
  const [input, setInput] = useState('');
  const [exportedIds, setExportedIds] = useState<Set<string>>(() => new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending) return;
    onSend(input.trim());
    setInput('');
  };

  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--bg-surface)' }}>
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((msg) => {
          if (msg.role !== 'user' && !msg.widget && !msg.content && !msg.pending) return null;

          return (
            <div
              key={msg.id}
              className="flex flex-col"
              style={{
                alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                className="max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed"
                style={
                  msg.role === 'user'
                    ? {
                        background: 'linear-gradient(135deg, var(--accent), var(--accent-cyan))',
                        color: '#fff',
                        borderBottomRightRadius: '4px',
                      }
                    : {
                        background: 'var(--bg-raised)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-subtle)',
                        borderBottomLeftRadius: '4px',
                      }
                }
              >
                {msg.role === 'user' ? (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                ) : msg.pending && !msg.content ? (
                  <p className="text-slate-400">Thinking...</p>
                ) : msg.widget && !msg.pending ? (
                    <div
                      className="mt-0 overflow-hidden rounded-xl"
                      style={{ border: '1px solid var(--border-subtle)', background: 'var(--bg-base)' }}
                    >
                      <WidgetRenderer widget={msg.widget} />
                      {onAddWidgetFromChat && (
                        <button
                          disabled={exportedIds.has(msg.widget.id)}
                          onClick={() => {
                            onAddWidgetFromChat(msg.widget!);
                            setExportedIds((prev) => new Set(prev).add(msg.widget!.id));
                          }}
                          className="w-full py-2 text-[11px] font-medium transition-colors"
                          style={{
                            color: exportedIds.has(msg.widget.id) ? 'var(--text-muted)' : 'var(--accent)',
                            borderTop: '1px solid var(--border-subtle)',
                          }}
                        >
                          {exportedIds.has(msg.widget.id) ? '✓ Added to dashboard' : '+ Add to dashboard'}
                        </button>
                      )}
                    </div>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="p-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <form onSubmit={handleSubmit}>
          <div
            className="flex items-end gap-2 rounded-2xl px-4 py-2.5 transition-all"
            style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-muted)' }}
            onFocusCapture={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-accent)')}
            onBlurCapture={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-muted)')}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); }
              }}
              placeholder="Ask for a chart, table, map…"
              rows={1}
              className="flex-1 resize-none bg-transparent text-xs leading-relaxed outline-none"
              style={{ color: 'var(--text-primary)', maxHeight: '96px' }}
            />
            <button
              type={sending ? 'button' : 'submit'}
              onClick={sending ? onStop : undefined}
              disabled={!sending && !input.trim()}
              aria-label={sending ? 'Stop generating response' : 'Send message'}
              title={sending ? 'Stop generating response' : 'Send message'}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-30"
              style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-cyan))', color: '#fff' }}
            >
              {sending ? <Square size={12} fill="currentColor" /> : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
