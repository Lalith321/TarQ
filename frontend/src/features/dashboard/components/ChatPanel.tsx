import { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { AgentMessage } from '../hooks/useDashboardAgent';
import WidgetRenderer from './widgets/WidgetRenderer';

interface Props {
  messages: AgentMessage[];
  sending: boolean;
  onSend: (text: string) => void;
  onClear?: () => void;
  onAddWidgetFromChat?: (widget: NonNullable<AgentMessage['widget']>) => void;
}

export function ChatPanel({ messages, sending, onSend, onClear, onAddWidgetFromChat }: Props) {
  const [input, setInput] = useState('');
  const [exportedWidgetIds, setExportedWidgetIds] = useState<Set<string>>(() => new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending) return;
    onSend(input.trim());
    setInput('');
  };

  return (
    <div className="flex h-full flex-col border-l bg-background">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
          </div>
          <span className="text-sm font-medium">Data Agent</span>
        </div>
        {onClear && messages.length > 1 && <button onClick={onClear} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : msg.role === 'system' ? 'items-center' : 'items-start'}`}>
            {msg.role === 'system' ? (
              <span className="max-w-[90%] rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">{msg.content}</span>
            ) : (
              <div className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                {msg.pending ? (
                  <div className="flex items-center gap-1.5 py-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: '0ms' }}/>
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: '150ms' }}/>
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: '300ms' }}/>
                  </div>
                ) : <p className="whitespace-pre-wrap">{msg.content}</p>}

                {msg.widget && !msg.pending && (
                  <div className="mt-2 rounded-md border bg-card p-2">
                    <WidgetRenderer widget={msg.widget} />
                    {onAddWidgetFromChat && (
                      <button
                        disabled={exportedWidgetIds.has(msg.widget.id)}
                        onClick={() => {
                          onAddWidgetFromChat(msg.widget!);
                          setExportedWidgetIds((prev) => new Set(prev).add(msg.widget!.id));
                        }}
                        className="mt-2 text-xs text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
                      >
                        {exportedWidgetIds.has(msg.widget.id) ? 'Exported' : 'Export to dashboard'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="border-t p-3">
        <div className="flex items-end gap-2 rounded-lg border bg-background px-3 py-2 focus-within:ring-1 focus-within:ring-ring">
          <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }} placeholder="Ask for a chart, table, map…" rows={1} className="flex-1 resize-none bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none max-h-32"/>
          <Button type="submit" size="icon" variant="ghost" disabled={!input.trim() || sending} className="h-8 w-8 text-primary disabled:text-muted-foreground">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </Button>
        </div>
      </form>
    </div>
  );
}
