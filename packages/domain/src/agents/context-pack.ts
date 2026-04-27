import { systemClock } from '../shared/clock';
import { createId, type EntityId } from '../shared/ids';

export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Blocking';

export interface ContextCitation {
  sourceId: string;
  quote: string;
}

export interface ContextSection {
  name: string;
  content: string;
}

export interface ContextPack {
  id: EntityId<'context_pack'>;
  artifactId?: EntityId<'artifact'>;
  taskGoal: string;
  agentRole: string;
  riskLevel: RiskLevel;
  sections: ContextSection[];
  citations: ContextCitation[];
  exclusions: string[];
  warnings: string[];
  retrievalTrace: string[];
  createdAt: string;
}

export function createContextPack(input: Omit<ContextPack, 'id' | 'createdAt'>): ContextPack {
  return {
    id: createId('context_pack'),
    createdAt: systemClock.now(),
    ...input
  };
}
