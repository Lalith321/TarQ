import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { createAnalystSession, sendAnalystMessage, uploadAnalystDataset } from '@/services/analystService';
import { fetchAgentConfigs, saveAgentConfigs, resetAgentConfigs } from '@/services/agentConfigService';
import type { AgentType, AgentConfig } from '@/services/agentConfigService';
import AnalystStatePanel from './AnalystStatePanel';

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */

const AGENTS: { id: AgentType; name: string; role: string; description: string; icon: React.ReactNode; accent: string; glow: string }[] = [
  {
    id: 'coordinator',
    name: 'Coordinator',
    role: 'Orchestrator',
    description: 'Orchestrates tasks and delegates work between agents. Determines how TarQ solves complex requests.',
    accent: 'border-blue-500/30 bg-blue-500/5 text-blue-400',
    glow: 'shadow-[0_0_40px_-10px_rgba(59,130,246,0.3)]',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      </svg>
    ),
  },
  {
    id: 'analyst',
    name: 'Analyst',
    role: 'Deep Analysis',
    description: 'Facts, calculations and reasoning. Handles quantitative evidence and distinguishes assumptions from facts.',
    accent: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400',
    glow: 'shadow-[0_0_40px_-10px_rgba(16,185,129,0.3)]',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" />
      </svg>
    ),
  },
  {
    id: 'narrator',
    name: 'Narrator & Creator',
    role: 'Creative',
    description: 'Creates presentations, videos, animations, graphics and narration from data and instructions.',
    accent: 'border-purple-500/30 bg-purple-500/5 text-purple-400',
    glow: 'shadow-[0_0_40px_-10px_rgba(168,85,247,0.3)]',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="5 3 19 12 5 21 5 3" />
      </svg>
    ),
  },
];

const VOICES = ['Professional', 'Conversational', 'Energetic', 'Documentary', 'Storytelling'];
const STYLES = ['Documentary', 'Cinematic', 'Minimal', 'Bold', 'Technical'];

/* ── Safe defaults so the UI never disappears ── */
const DEFAULT_CONFIGS: Record<AgentType, AgentConfig> = {
  coordinator: { enabled: true, instructions: 'You are the orchestrator. Delegate tasks clearly.' },
  analyst: { enabled: true, instructions: 'You are the analyst. Use facts and data only.' },
  narrator: {
    enabled: true,
    instructions: 'You are the narrator. Create compelling visuals and stories.',
    voice: 'professional',
    style: 'documentary',
    creativity: 50,
  },
};

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export default function AnalystPanel() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [selectedAgent, setSelectedAgent] = useState<AgentType>('coordinator');
  const [configs, setConfigs] = useState<Record<AgentType, AgentConfig>>(DEFAULT_CONFIGS);
  const [configsLoading, setConfigsLoading] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [csvPath, setCsvPath] = useState<string | null>(null);
  const [target, setTarget] = useState('');
  const [prompt, setPrompt] = useState('');
  const [isInjecting, setIsInjecting] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  /* ── Load configs from API (non-blocking) ── */
  useEffect(() => {
    setConfigsLoading(true);
    fetchAgentConfigs()
      .then((c) => { if (c) setConfigs(c); })
      .catch((e) => toast({ title: 'Failed to load configs', description: String(e), variant: 'destructive' }))
      .finally(() => setConfigsLoading(false));
  }, [toast]);

  /* ── Auto-save ── */
  useEffect(() => {
    if (!hasChanges) return;
    const t = setTimeout(() => {
      saveAgentConfigs(configs)
        .then(() => { setSavedAt(new Date()); setHasChanges(false); })
        .catch((e) => toast({ title: 'Auto-save failed', description: String(e), variant: 'destructive' }));
    }, 1500);
    return () => clearTimeout(t);
  }, [configs, hasChanges, toast]);

  /* ── Handlers ── */
  const updateConfig = useCallback((agent: AgentType, patch: Partial<AgentConfig>) => {
    setConfigs((prev) => ({ ...prev, [agent]: { ...prev[agent], ...patch } }));
    setHasChanges(true);
  }, []);

  const handleReset = async () => {
    try {
      const defaults = await resetAgentConfigs();
      setConfigs(defaults ?? DEFAULT_CONFIGS);
      setHasChanges(false);
      setSavedAt(null);
      toast({ title: 'Reset to defaults' });
    } catch (e: any) {
      toast({ title: 'Reset failed', description: e.message, variant: 'destructive' });
    }
  };

  const handleManualSave = async () => {
    try {
      await saveAgentConfigs(configs);
      setSavedAt(new Date());
      setHasChanges(false);
      toast({ title: 'Saved' });
    } catch (e: any) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    }
  };

  const handleStartSession = async () => {
    try {
      const id = await createAnalystSession();
      setSessionId(id);
      setOutput(null);
      setRefreshKey((k) => k + 1);
      toast({ title: 'Session started', description: `ID: ${id.slice(0, 8)}...` });
    } catch (err) {
      toast({ title: 'Session failed', description: String(err), variant: 'destructive' });
    }
  };

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!sessionId || !file) return;
    try {
      const path = await uploadAnalystDataset(sessionId, file);
      setCsvPath(path);
      toast({ title: 'Dataset uploaded', description: path });
    } catch (err) {
      toast({ title: 'Upload failed', description: String(err), variant: 'destructive' });
    }
  };

  const handleInject = async () => {
    if (!sessionId) {
      toast({ title: 'No session', description: 'Start a session first.', variant: 'destructive' });
      return;
    }
    if (!prompt.trim()) return;
    setIsInjecting(true);
    try {
      const hints = csvPath ? { csv_path: csvPath, df_name: 'df', target: target.trim() || undefined } : undefined;
      const res = await sendAnalystMessage(sessionId, prompt.trim(), hints);
      setOutput(res.answer);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast({ title: 'Injection failed', description: String(err), variant: 'destructive' });
    } finally {
      setIsInjecting(false);
    }
  };

  const current = configs[selectedAgent];
  const agentMeta = AGENTS.find((a) => a.id === selectedAgent)!;

  return (
    <div className="relative space-y-6">
      {/* ═════════════════════════════════════════════════════════
         SECTION 1 — AGENT FLEET
         ═════════════════════════════════════════════════════════ */}
      <section>
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          Agent Fleet
          <span className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {configsLoading
            ? [1, 2, 3].map((i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-white/[0.02]" />)
            : AGENTS.map((agent) => {
                const cfg = configs[agent.id];
                const isSelected = selectedAgent === agent.id;
                return (
                  <button
                    key={agent.id}
                    onClick={() => setSelectedAgent(agent.id)}
                    className={`relative overflow-hidden rounded-2xl border p-5 text-left transition-all duration-300 ${
                      isSelected
                        ? `${agent.accent} ${agent.glow} ring-1 ring-white/10`
                        : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.10] hover:bg-white/[0.04]'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute inset-0 opacity-30">
                        <div className="absolute -inset-full top-0 block h-full w-1/2 -skew-x-12 bg-gradient-to-r from-transparent to-white/10 animate-[shimmer_2s_infinite]" />
                      </div>
                    )}

                    <div className="relative flex items-start justify-between">
                      <div className={`rounded-xl p-2.5 ${isSelected ? 'bg-white/10' : 'bg-white/5'}`}>
                        {agent.icon}
                      </div>
                      <div
                        className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                          cfg.enabled
                            ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20'
                            : 'bg-slate-800 text-slate-500 ring-1 ring-white/5'
                        }`}
                      >
                        <span className={`relative flex h-1.5 w-1.5 rounded-full ${cfg.enabled ? 'bg-emerald-400' : 'bg-slate-600'}`}>
                          {cfg.enabled && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
                        </span>
                        {cfg.enabled ? 'Active' : 'Inactive'}
                      </div>
                    </div>

                    <div className="relative mt-4">
                      <h3 className="text-sm font-bold text-white">{agent.name}</h3>
                      <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">{agent.role}</p>
                      <p className="mt-2 text-xs leading-relaxed text-slate-400">{agent.description}</p>
                    </div>
                  </button>
                );
              })}
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════
         SECTION 2 — COMMAND CORE
         ═════════════════════════════════════════════════════════ */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Agent Configuration */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl">
          <div className="border-b border-white/[0.06] px-5 py-4">
            <div className="flex items-center gap-2">
              <span className={agentMeta.accent.split(' ')[2]}>{agentMeta.icon}</span>
              <div>
                <h3 className="text-sm font-semibold text-white">{agentMeta.name}</h3>
                <p className="text-[10px] text-slate-500">Configuration</p>
              </div>
            </div>
          </div>

          {configsLoading ? (
            <div className="space-y-4 p-5">
              <div className="h-5 animate-pulse rounded bg-white/[0.02]" />
              <div className="h-24 animate-pulse rounded-xl bg-white/[0.02]" />
              <div className="h-5 animate-pulse rounded bg-white/[0.02]" />
            </div>
          ) : (
            <div className="space-y-5 p-5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-300">Agent Enabled</label>
                <button
                  onClick={() => updateConfig(selectedAgent, { enabled: !current.enabled })}
                  className={`relative h-5 w-9 rounded-full transition-colors ${current.enabled ? 'bg-primary' : 'bg-slate-700'}`}
                >
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${current.enabled ? 'left-[18px]' : 'left-0.5'}`} />
                </button>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">Behavior Instructions</label>
                <textarea
                  value={current.instructions}
                  onChange={(e) => updateConfig(selectedAgent, { instructions: e.target.value })}
                  rows={5}
                  className="w-full rounded-xl border border-white/10 bg-slate-900/50 p-3 text-xs leading-relaxed text-slate-200 placeholder:text-slate-600 outline-none transition-all focus:border-primary/30 focus:ring-1 focus:ring-primary/20 resize-none"
                />
              </div>

              {selectedAgent === 'narrator' && (
                <>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-300">Voice</label>
                    <div className="grid grid-cols-2 gap-2">
                      {VOICES.map((v) => (
                        <button
                          key={v}
                          onClick={() => updateConfig('narrator', { voice: v.toLowerCase() })}
                          className={`rounded-lg border px-3 py-2 text-[11px] font-medium transition-all ${
                            current.voice === v.toLowerCase()
                              ? 'border-purple-500/30 bg-purple-500/10 text-purple-300'
                              : 'border-white/5 bg-white/[0.02] text-slate-400 hover:border-white/10'
                          }`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-300">Style</label>
                    <select
                      value={current.style}
                      onChange={(e) => updateConfig('narrator', { style: e.target.value })}
                      className="h-9 w-full rounded-lg border border-white/10 bg-slate-900/50 px-3 text-xs text-slate-200 outline-none focus:border-primary/30"
                    >
                      {STYLES.map((s) => (
                        <option key={s} value={s.toLowerCase()}>{s}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label className="text-xs font-medium text-slate-300">Creativity</label>
                      <span className="text-[10px] tabular-nums text-slate-500">{(current.creativity ?? 50)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={current.creativity ?? 50}
                      onChange={(e) => updateConfig('narrator', { creativity: Number(e.target.value) })}
                      className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-800 accent-primary outline-none"
                    />
                    <div className="mt-1.5 flex justify-between text-[10px] text-slate-600">
                      <span>Conservative</span>
                      <span>Creative</span>
                    </div>
                  </div>
                </>
              )}

              {selectedAgent === 'coordinator' && (
                <div className="space-y-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Agent Collaboration</p>
                  {(['analyst', 'narrator'] as AgentType[]).map((id) => (
                    <label key={id} className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3 transition-colors hover:border-white/10">
                      <input
                        type="checkbox"
                        checked={configs[id].enabled}
                        onChange={(e) => updateConfig(id, { enabled: e.target.checked })}
                        className="h-4 w-4 rounded border-white/10 bg-slate-900 text-primary focus:ring-primary/20"
                      />
                      <span className="text-xs capitalize text-slate-300">{id}</span>
                      <span className="ml-auto text-[10px] text-slate-500">{configs[id].enabled ? 'Enabled' : 'Disabled'}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Prompt Injection */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="flex-1 rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl">
            <div className="border-b border-white/[0.06] px-5 py-4">
              <h3 className="text-sm font-semibold text-white">Prompt Injection</h3>
              <p className="text-[10px] text-slate-500">Define specifications and inject into the active session.</p>
            </div>

            <div className="space-y-4 p-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-300">Target Column</label>
                  <Input
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    placeholder="e.g. revenue"
                    className="h-9 border-white/10 bg-slate-900/50 text-xs text-white placeholder:text-slate-600 focus-visible:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-300">Dataset</label>
                  <div className="flex gap-2">
                    <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleUpload} />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileRef.current?.click()}
                      className="h-9 gap-2 border-white/10 bg-transparent text-xs text-slate-300 hover:bg-white/5 hover:text-white"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      {csvPath ? 'Change' : 'Upload CSV'}
                    </Button>
                    {csvPath && <span className="flex items-center text-[11px] text-emerald-400">{csvPath}</span>}
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="absolute left-4 top-4 text-primary/60 font-mono text-sm">{'>'}</div>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleInject(); }}
                  placeholder="Enter your analytical prompt here..."
                  rows={8}
                  className="w-full rounded-xl border border-white/10 bg-slate-950/50 py-4 pl-10 pr-4 font-mono text-sm leading-relaxed text-slate-200 placeholder:text-slate-600 outline-none transition-all focus:border-primary/30 focus:shadow-[0_0_20px_-5px_rgba(59,130,246,0.15)] focus:ring-1 focus:ring-primary/20 resize-none"
                />
                <div className="absolute bottom-3 right-3 text-[10px] text-slate-600">
                  {prompt.length} chars · Cmd+Enter to inject
                </div>
              </div>

              <div className="flex items-center justify-between">
                {!sessionId ? (
                  <Button
                    onClick={handleStartSession}
                    variant="outline"
                    className="gap-2 border-white/10 bg-transparent text-xs text-slate-300 hover:bg-white/5 hover:text-white"
                  >
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                    </span>
                    Initialize Session
                  </Button>
                ) : (
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Session {sessionId.slice(0, 8)}...
                  </div>
                )}

                <Button
                  onClick={handleInject}
                  disabled={isInjecting || !sessionId || !prompt.trim()}
                  className="relative gap-2 overflow-hidden rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                >
                  {isInjecting ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Injecting...
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                      </svg>
                      Inject Prompt
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════
         SECTION 3 — OUTPUT TERMINAL
         ═════════════════════════════════════════════════════════ */}
      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-500">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            <h3 className="text-sm font-semibold text-white">Output Console</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-600" />
            <span className="text-[10px] text-slate-500">{output ? 'Result received' : 'Idle'}</span>
          </div>
        </div>
        <div className="relative p-5">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent animate-[scan_3s_linear_infinite]" />
          {output ? (
            <div className="rounded-xl border border-white/5 bg-slate-950/50 p-4">
              <p className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-slate-300">{output}</p>
            </div>
          ) : (
            <div className="flex h-32 items-center justify-center text-slate-600">
              <p className="text-xs">Waiting for prompt injection...</p>
            </div>
          )}
          <div className="mt-4">
            <AnalystStatePanel sessionId={sessionId} refreshKey={refreshKey} />
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════
         FOOTER BAR
         ═════════════════════════════════════════════════════════ */}
      <div className="flex flex-col gap-4 border-t border-white/[0.06] pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {configsLoading ? (
            <>
              <span className="h-2 w-2 animate-pulse rounded-full bg-slate-600" />
              Loading configuration...
            </>
          ) : hasChanges ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
              </span>
              Unsaved changes...
            </>
          ) : savedAt ? (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-500">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Changes saved automatically · {savedAt.toLocaleTimeString()}
            </>
          ) : (
            <>
              <span className="h-2 w-2 rounded-full bg-slate-700" />
              Defaults loaded
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-xs text-slate-400 hover:bg-white/5 hover:text-white"
          >
            Reset to default
          </Button>
          <Button
            size="sm"
            onClick={handleManualSave}
            className="rounded-full bg-white px-5 text-xs font-medium text-slate-950 shadow-lg shadow-white/10 transition-all hover:shadow-xl hover:shadow-white/15 hover:scale-[1.02] active:scale-[0.98]"
          >
            Save changes
          </Button>
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%) skewX(-12deg); }
          100% { transform: translateX(200%) skewX(-12deg); }
        }
        @keyframes scan {
          0% { transform: translateY(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(400px); opacity: 0; }
        }
      `}</style>
    </div>
  );
}