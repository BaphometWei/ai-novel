import type { MemoryStatus, RiskLevel } from '@ai-novel/domain';

export type RetrievalItemKind = 'memory' | 'sample' | 'manuscript' | 'review';

export interface SourcePolicySlice {
  allowedUse: string[];
  prohibitedUse: string[];
}

export interface RetrievalItem {
  id: string;
  kind: RetrievalItemKind;
  entityKey: string;
  status: MemoryStatus;
  text: string;
  sourcePolicy: SourcePolicySlice;
}

export interface ContextBuildInput {
  taskGoal: string;
  agentRole: string;
  riskLevel: RiskLevel;
  query: string;
  items: RetrievalItem[];
}

export function canUseForGeneration(item: RetrievalItem): boolean {
  return item.sourcePolicy.allowedUse.includes('generation_support')
    && !item.sourcePolicy.prohibitedUse.includes('generation_support');
}

export function memoryStatusRank(status: MemoryStatus): number {
  if (status === 'Canon') return 4;
  if (status === 'Draft') return 3;
  if (status === 'Candidate') return 2;
  if (status === 'Conflict') return 1;
  return 0;
}
