import { createId, type EntityId, type RiskLevel } from '@ai-novel/domain';

export interface TaskContract {
  id: string;
  projectId: EntityId<'project'>;
  taskType: string;
  agentRole: string;
  riskLevel: RiskLevel;
  outputSchema: string;
}

export function createTaskContract(input: Omit<TaskContract, 'id'>): TaskContract {
  return {
    id: `task_contract_${createId('agent_run').slice('agent_run_'.length)}`,
    ...input
  };
}
