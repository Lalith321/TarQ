// services/agentConfigService.ts
import { API_BASE_URL } from '@/lib/apiEndpoints';

export type AgentType = 'coordinator' | 'analyst' | 'narrator';

export interface AgentConfig {
  enabled: boolean;
  instructions: string;
  voice?: string;
  style?: string;
  creativity?: number;
}

export interface AgentFleet {
  id: string;
  name: string;
  configs: Record<AgentType, AgentConfig>;
}

export interface AgentFleetCollection {
  fleets: AgentFleet[];
  activeFleetId: string;
}

export const fetchAgentFleets = async (): Promise<AgentFleetCollection> => {
  const res = await fetch(`${API_BASE_URL}/api/agents/fleets`);
  if (!res.ok) throw new Error('Failed to fetch agent fleets');
  return res.json();
};

export const createAgentFleet = async (name: string, configs: Record<AgentType, AgentConfig>): Promise<AgentFleet> => {
  const res = await fetch(`${API_BASE_URL}/api/agents/fleets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, configs }),
  });
  if (!res.ok) throw new Error('Failed to create agent fleet');
  const result: { fleet: AgentFleet } = await res.json();
  return result.fleet;
};

export const updateAgentFleet = async (
  id: string,
  update: { name?: string; configs?: Record<AgentType, AgentConfig> },
): Promise<AgentFleet> => {
  const res = await fetch(`${API_BASE_URL}/api/agents/fleets/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(update),
  });
  if (!res.ok) throw new Error('Failed to update agent fleet');
  return res.json();
};

export const deleteAgentFleet = async (id: string): Promise<AgentFleetCollection> => {
  const res = await fetch(`${API_BASE_URL}/api/agents/fleets/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete agent fleet');
  return res.json();
};

export const activateAgentFleet = async (id: string): Promise<{ fleet: AgentFleet; activeFleetId: string }> => {
  const res = await fetch(`${API_BASE_URL}/api/agents/fleets/${encodeURIComponent(id)}/activate`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to activate agent fleet');
  return res.json();
};

export const resetAgentFleet = async (id: string): Promise<AgentFleet> => {
  const res = await fetch(`${API_BASE_URL}/api/agents/fleets/${encodeURIComponent(id)}/reset`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to reset agent fleet');
  return res.json();
};

export const fetchAgentConfigs = async (): Promise<Record<AgentType, AgentConfig>> => {
  const res = await fetch(`${API_BASE_URL}/api/agents/configs`);
  if (!res.ok) throw new Error('Failed to fetch agent configs');
  return res.json();
};

export const saveAgentConfigs = async (configs: Record<AgentType, AgentConfig>): Promise<void> => {
  const res = await fetch(`${API_BASE_URL}/api/agents/configs`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(configs),
  });
  if (!res.ok) throw new Error('Failed to save configs');
};

export const resetAgentConfigs = async (): Promise<Record<AgentType, AgentConfig>> => {
  const res = await fetch(`${API_BASE_URL}/api/agents/configs/reset`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to reset configs');
  return res.json();
};