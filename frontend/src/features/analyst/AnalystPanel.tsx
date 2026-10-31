import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Check, ChevronDown, Pencil, Search, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { createAnalystSession, streamAnalystMessage } from '@/services/analystService';
import { readUserSettings } from '@/services/userSettings';
import {
  activateAgentFleet,
  createAgentFleet,
  deleteAgentFleet,
  fetchAgentFleets,
  resetAgentFleet,
  updateAgentFleet,
} from '@/services/agentConfigService';
import type { AgentFleet, AgentType, AgentConfig } from '@/services/agentConfigService';

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
  coordinator: {
    enabled: true,
    instructions: 'Break requests into clear, ordered tasks and delegate each to the right agent. Preserve the user’s constraints, flag important ambiguity, and report blockers instead of guessing.',
  },
  analyst: {
    enabled: true,
    instructions: 'Use only the selected data sources. Compute every reported figure from data, preserve filters and time ranges, and explain important assumptions or limitations. Never invent results.',
  },
  narrator: {
    enabled: true,
    instructions: 'Create a concise Remotion video from verified analysis artifacts. Preserve values, labels, units, and caveats; use purposeful data-driven scenes and motion, then report the rendered artifact and any blockers.',
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
  // Keep toast in a ref so effects always have the latest version
  // without needing it as a dependency (avoids spurious re-runs).
  const toastRef = useRef(toast);
  useEffect(() => { toastRef.current = toast; });
  const [selectedAgent, setSelectedAgent] = useState<AgentType>('coordinator');
  const [configs, setConfigs] = useState<Record<AgentType, AgentConfig>>(DEFAULT_CONFIGS);
  const [fleets, setFleets] = useState<AgentFleet[]>([]);
  const [selectedFleetId, setSelectedFleetId] = useState('default');
  const [activeFleetId, setActiveFleetId] = useState('default');
  const [fleetName, setFleetName] = useState('');
  const [newFleetName, setNewFleetName] = useState('');
  const [fleetMenuOpen, setFleetMenuOpen] = useState(false);
  const [fleetSearch, setFleetSearch] = useState('');
  const [editingFleetId, setEditingFleetId] = useState<string | null>(null);
  const [editingFleetName, setEditingFleetName] = useState('');
  const [fleetActionLoading, setFleetActionLoading] = useState(false);
  const [configsLoading, setConfigsLoading] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isInjecting, setIsInjecting] = useState(false);

  /* ── Load configs from API (non-blocking) ── */
  useEffect(() => {
    setConfigsLoading(true);
    fetchAgentFleets()
      .then(({ fleets: loadedFleets, activeFleetId: loadedActiveFleetId }) => {
        setFleets(loadedFleets);
        setActiveFleetId(loadedActiveFleetId);
        const activeFleet = loadedFleets.find((fleet) => fleet.id === loadedActiveFleetId) ?? loadedFleets[0];
        if (activeFleet) {
          setSelectedFleetId(activeFleet.id);
          setFleetName(activeFleet.name);
          setConfigs(activeFleet.configs);
        }
      })
      .catch((e) => toastRef.current({ title: 'Failed to load configs', description: String(e), variant: 'destructive' }))
      .finally(() => setConfigsLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- toastRef is a stable ref

  /* ── Auto-save ── */
  useEffect(() => {
    if (!hasChanges) return;
    const t = setTimeout(() => {
      updateAgentFleet(selectedFleetId, { configs })
        .then((fleet) => {
          setFleets((currentFleets) => currentFleets.map((current) => current.id === fleet.id ? fleet : current));
          setSavedAt(new Date());
          setHasChanges(false);
        })
        .catch((e) => toastRef.current({ title: 'Auto-save failed', description: String(e), variant: 'destructive' }));
    }, 1500);
    return () => clearTimeout(t);
  }, [configs, hasChanges, selectedFleetId]); // toastRef is a stable ref, omitted intentionally

  /* ── Handlers ── */
  const updateConfig = useCallback((agent: AgentType, patch: Partial<AgentConfig>) => {
    setConfigs((prev) => ({ ...prev, [agent]: { ...prev[agent], ...patch } }));
    setHasChanges(true);
  }, []);

  const handleReset = async () => {
    try {
      const fleet = await resetAgentFleet(selectedFleetId);
      setConfigs(fleet.configs);
      setFleets((currentFleets) => currentFleets.map((current) => current.id === fleet.id ? fleet : current));
      setHasChanges(false);
      setSavedAt(null);
      toast({ title: 'Reset to defaults' });
    } catch (e: any) {
      toast({ title: 'Reset failed', description: e.message, variant: 'destructive' });
    }
  };

  const handleManualSave = async () => {
    try {
      const fleet = await updateAgentFleet(selectedFleetId, { configs });
      setFleets((currentFleets) => currentFleets.map((current) => current.id === fleet.id ? fleet : current));
      setSavedAt(new Date());
      setHasChanges(false);
      toast({ title: 'Saved' });
    } catch (e: any) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    }
  };

  const handleSelectFleet = async (fleet: AgentFleet) => {
    if (fleet.id === selectedFleetId) return;
    try {
      if (hasChanges) {
        const saved = await updateAgentFleet(selectedFleetId, { configs });
        setFleets((currentFleets) => currentFleets.map((current) => current.id === saved.id ? saved : current));
      }
      setSelectedFleetId(fleet.id);
      setFleetName(fleet.name);
      setConfigs(fleet.configs);
      setHasChanges(false);
      setSavedAt(null);
    } catch (e) {
      toast({ title: 'Could not open fleet', description: String(e), variant: 'destructive' });
    }
  };

  const handleSaveFleetName = async (fleetId: string) => {
    try {
      const fleet = await updateAgentFleet(fleetId, { name: editingFleetName });
      if (fleet.id === selectedFleetId) setFleetName(fleet.name);
      setFleets((currentFleets) => currentFleets.map((current) => current.id === fleet.id ? fleet : current));
      setEditingFleetId(null);
      toast({ title: 'Team name saved' });
    } catch (e) {
      toast({ title: 'Could not rename team', description: String(e), variant: 'destructive' });
    }
  };

  const handleCreateFleet = async () => {
    const name = newFleetName.trim();
    if (!name || fleetActionLoading) return;
    setFleetActionLoading(true);
    try {
      if (hasChanges) {
        const saved = await updateAgentFleet(selectedFleetId, { configs });
        setFleets((currentFleets) => currentFleets.map((current) => current.id === saved.id ? saved : current));
      }
      const fleet = await createAgentFleet(name, configs);
      setFleets((currentFleets) => [...currentFleets, fleet]);
      setSelectedFleetId(fleet.id);
      setFleetName(fleet.name);
      setNewFleetName('');
      setHasChanges(false);
      setSavedAt(null);
      setFleetMenuOpen(false);
      setFleetSearch('');
      toast({ title: 'Team created', description: `${fleet.name} is ready to edit.` });
    } catch (e) {
      toast({ title: 'Could not create team', description: String(e), variant: 'destructive' });
    } finally {
      setFleetActionLoading(false);
    }
  };

  const handleDeleteFleet = async (fleet: AgentFleet) => {
    if (fleets.length <= 1 || !window.confirm(`Delete team "${fleet.name}"?`)) return;
    try {
      const result = await deleteAgentFleet(fleet.id);
      setFleets(result.fleets);
      setActiveFleetId(result.activeFleetId);
      if (fleet.id === selectedFleetId) {
        const nextFleet = result.fleets.find((item) => item.id === result.activeFleetId) ?? result.fleets[0];
        setSelectedFleetId(nextFleet.id);
        setFleetName(nextFleet.name);
        setConfigs(nextFleet.configs);
        setHasChanges(false);
        setSavedAt(null);
      }
      setEditingFleetId(null);
      toast({ title: 'Team deleted' });
    } catch (e) {
      toast({ title: 'Could not delete team', description: String(e), variant: 'destructive' });
    }
  };

  const handleActivateFleet = async (fleetId: string) => {
    try {
      if (hasChanges) {
        const saved = await updateAgentFleet(selectedFleetId, { configs });
        setFleets((currentFleets) => currentFleets.map((current) => current.id === saved.id ? saved : current));
      }
      const result = await activateAgentFleet(fleetId);
      setActiveFleetId(result.activeFleetId);
      const activatedFleet = result.fleet;
      setFleets((currentFleets) => currentFleets.map((current) => current.id === activatedFleet.id ? activatedFleet : current));
      if (selectedFleetId === fleetId) setConfigs(activatedFleet.configs);
      toast({ title: 'Team activated', description: `${activatedFleet.name} now runs orchestration.` });
    } catch (e) {
      toast({ title: 'Could not activate team', description: String(e), variant: 'destructive' });
    }
  };

  const handleInject = useCallback(async () => {
    const instructions = configs[selectedAgent].instructions.trim();
    if (!instructions) return;
    setIsInjecting(true);

    try {
      const activeSessionId = sessionId ?? await createAnalystSession();
      if (!sessionId) setSessionId(activeSessionId);

      const userSettings = readUserSettings();
      streamAnalystMessage(activeSessionId, instructions, {
        selectedSources: [],
        fleetId: selectedFleetId,
        modelSettings: {
          provider: userSettings.selectedProvider,
          model: userSettings.selectedModel,
          api_key: userSettings.keys[userSettings.selectedProvider],
        },
      }, (event) => {
        if (event.type === 'final') {
          setIsInjecting(false);
        } else if (event.type === 'error') {
          toast({ title: 'Stream error', description: event.message, variant: 'destructive' });
          setIsInjecting(false);
        }
      });
    } catch (err) {
      toast({ title: 'Could not start agent session', description: String(err), variant: 'destructive' });
      setIsInjecting(false);
    }
  }, [sessionId, configs, selectedAgent, selectedFleetId, toast]);

  const current = configs[selectedAgent];
  const agentMeta = AGENTS.find((a) => a.id === selectedAgent)!;
  const filteredFleets = fleets.filter((fleet) => fleet.name.toLowerCase().includes(fleetSearch.trim().toLowerCase()));

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

        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-white">Teams</h2>
          <div className="relative flex w-full max-w-xs">
            <input
              value={newFleetName}
              onChange={(event) => setNewFleetName(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') void handleCreateFleet(); }}
              placeholder="Type team name"
              aria-label="New team name"
              disabled={configsLoading || fleetActionLoading}
              className="h-9 min-w-0 flex-1 rounded-l-md border border-r-0 border-white/10 bg-slate-950/60 px-3 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-primary/40 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => {
                setFleetMenuOpen((open) => !open);
                setFleetSearch('');
              }}
              aria-label="Open team list"
              aria-haspopup="dialog"
              aria-expanded={fleetMenuOpen}
              title="Choose a team"
              className="flex h-9 w-8 shrink-0 items-center justify-center rounded-r-md border border-white/10 bg-slate-950/60 text-slate-400 hover:bg-slate-900 hover:text-white"
            >
              <ChevronDown size={13} className={`transition-transform ${fleetMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {fleetMenuOpen && (
              <div role="dialog" aria-label="Choose team" className="absolute right-0 top-10 z-30 w-full rounded-md border border-white/10 bg-slate-950 p-1 shadow-xl shadow-black/40">
                <div className="relative mb-1 border-b border-white/[0.07] pb-1">
                  <Search size={13} className="pointer-events-none absolute left-2.5 top-2.5 text-slate-500" />
                  <input
                    autoFocus
                    type="search"
                    value={fleetSearch}
                    onChange={(event) => setFleetSearch(event.target.value)}
                    onKeyDown={(event) => { if (event.key === 'Escape') setFleetMenuOpen(false); }}
                    placeholder="Search teams"
                    aria-label="Search teams"
                    className="h-8 w-full rounded-sm bg-white/[0.04] pl-8 pr-2 text-xs text-slate-200 outline-none placeholder:text-slate-500 focus:bg-white/[0.07]"
                  />
                </div>
                <div className="max-h-64 overflow-y-auto">
                {filteredFleets.map((fleet) => (
                  <div key={fleet.id} className={`flex min-w-0 items-center gap-1 rounded px-1 ${fleet.id === selectedFleetId ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]'}`}>
                    {editingFleetId === fleet.id ? (
                      <>
                        <input
                          autoFocus
                          value={editingFleetName}
                          onChange={(event) => setEditingFleetName(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') void handleSaveFleetName(fleet.id);
                            if (event.key === 'Escape') setEditingFleetId(null);
                          }}
                          aria-label="Team name"
                          className="h-8 min-w-0 flex-1 bg-transparent px-2 text-xs text-white outline-none"
                        />
                        <button type="button" onClick={() => void handleSaveFleetName(fleet.id)} aria-label="Save team name" title="Save name" className="rounded p-1.5 text-emerald-400 hover:bg-white/10">
                          <Check size={14} />
                        </button>
                        <button type="button" onClick={() => setEditingFleetId(null)} aria-label="Cancel rename" title="Cancel" className="rounded p-1.5 text-slate-400 hover:bg-white/10">
                          <X size={14} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          role="option"
                          aria-selected={fleet.id === selectedFleetId}
                          onClick={() => { void handleSelectFleet(fleet); setFleetMenuOpen(false); setFleetSearch(''); }}
                          className="flex h-8 min-w-0 flex-1 items-center justify-between px-2 text-left text-xs text-slate-200"
                        >
                          <span className="truncate">{fleet.name}</span>
                          <span className="ml-2 shrink-0 text-[10px] text-slate-500">{fleet.id === activeFleetId ? 'Active' : ''}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setEditingFleetId(fleet.id); setEditingFleetName(fleet.name); }}
                          aria-label={`Rename ${fleet.name}`}
                          title="Rename team"
                          className="rounded p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteFleet(fleet)}
                          disabled={fleets.length <= 1}
                          aria-label={`Delete ${fleet.name}`}
                          title={fleets.length <= 1 ? 'At least one team must remain' : 'Delete team'}
                          className="rounded p-1.5 text-slate-400 hover:bg-red-500/10 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                ))}
                {filteredFleets.length === 0 && <p className="px-3 py-4 text-center text-xs text-slate-500">No teams found</p>}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Deep Agents</h2>
            <p className="mt-0.5 text-xs text-slate-500">Members of {fleetName || 'this team'}</p>
          </div>
          <span className="text-[10px] text-slate-500">Select an agent to edit its configuration</span>
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
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Agent Collaboration</p>
                    <span className="text-[10px] text-slate-600 italic">Coordinator is always active</span>
                  </div>
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

        {/* Behaviour Instructions */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl">
            <div className="border-b border-white/[0.06] px-5 py-4">
              <h3 className="text-sm font-semibold text-white">Behaviour Instructions <span className="font-normal text-slate-500">(optional)</span></h3>
              <p className="text-[10px] text-slate-500">Starter examples are editable. Add or clear extra guidance; TarQ’s built-in role instructions remain in effect.</p>
            </div>

            <div className="space-y-4 p-5">
              <div className="relative">
                <textarea
                  value={current.instructions}
                  onChange={(e) => updateConfig(selectedAgent, { instructions: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleInject(); }}
                  rows={8}
                  className="w-full rounded-xl border border-white/10 bg-slate-950/50 p-4 font-mono text-sm leading-relaxed text-slate-200 placeholder:text-slate-600 outline-none transition-all focus:border-primary/30 focus:shadow-[0_0_20px_-5px_rgba(59,130,246,0.15)] focus:ring-1 focus:ring-primary/20 resize-none"
                />
                <div className="absolute bottom-3 right-3 text-[10px] text-slate-600">
                  {current.instructions.length} chars · Cmd+Enter to send
                </div>
              </div>

              <div className="flex items-center justify-between">
                {sessionId ? (
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Session {sessionId.slice(0, 8)}...
                  </div>
                ) : <span />}

                <Button
                  onClick={handleInject}
                  disabled={isInjecting || !current.instructions.trim()}
                  className="relative gap-2 overflow-hidden rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                >
                  {isInjecting ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Sending...
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                      </svg>
                      Send
                    </>
                  )}
                </Button>
              </div>
            </div>
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