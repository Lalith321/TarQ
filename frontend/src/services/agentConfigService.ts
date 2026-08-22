// services/agentConfigService.ts
export type AgentType = 'coordinator' | 'analyst' | 'narrator';

export interface AgentConfig {
  enabled: boolean;
  instructions: string;
  voice?: string;
  style?: string;
  creativity?: number;
}

export const fetchAgentConfigs = async (): Promise<Record<AgentType, AgentConfig>> => {
  const res = await fetch('/api/agents/configs');
  if (!res.ok) throw new Error('Failed to fetch agent configs');
  return res.json();
};

export const saveAgentConfigs = async (configs: Record<AgentType, AgentConfig>): Promise<void> => {
  const res = await fetch('/api/agents/configs', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(configs),
  });
  if (!res.ok) throw new Error('Failed to save configs');
};

export const resetAgentConfigs = async (): Promise<Record<AgentType, AgentConfig>> => {
  const res = await fetch('/api/agents/configs/reset', { method: 'POST' });
  if (!res.ok) throw new Error('Failed to reset configs');
  return res.json();
};