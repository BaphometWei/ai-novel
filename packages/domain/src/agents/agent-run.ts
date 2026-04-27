import { systemClock } from '../shared/clock';
import { createId, type EntityId } from '../shared/ids';

export type AgentRunStatus = 'Queued' | 'Running' | 'Succeeded' | 'Failed' | 'Cancelled';

export interface AgentRun {
  id: EntityId<'agent_run'>;
  agentName: string;
  taskType: string;
  workflowType: string;
  promptVersionId: string;
  contextPackId: EntityId<'context_pack'>;
  status: AgentRunStatus;
  createdAt: string;
}

export function createAgentRun(input: Omit<AgentRun, 'id' | 'status' | 'createdAt'>): AgentRun {
  return {
    id: createId('agent_run'),
    status: 'Queued',
    createdAt: systemClock.now(),
    ...input
  };
}
