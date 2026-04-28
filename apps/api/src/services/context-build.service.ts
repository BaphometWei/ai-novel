import type { ContextPack, EntityId, RiskLevel, SourcePolicyDefaults } from '@ai-novel/domain';
import { buildContextPack, type RetrievalItem, type RetrievalItemKind } from '@ai-novel/retrieval';
import type { GlobalSearchResultType, GlobalSearchRouteStore } from '../routes/search.routes';
import type { SettingsService } from './settings.service';

export interface ServerContextBuildInput {
  projectId: EntityId<'project'>;
  taskGoal: string;
  agentRole: string;
  riskLevel: RiskLevel;
  query: string;
  maxContextItems?: number;
  maxSectionChars?: number;
}

export interface ContextBuildService {
  build(input: ServerContextBuildInput): Promise<ContextPack>;
}

export function createContextBuildService(input: {
  search: GlobalSearchRouteStore;
  settingsService: Pick<SettingsService, 'findSourcePolicyDefaults'>;
}): ContextBuildService {
  return {
    async build(request) {
      const sourcePolicy = await input.settingsService.findSourcePolicyDefaults();
      const results = await input.search.search({
        projectId: request.projectId,
        query: request.query,
        types: ['manuscript', 'canon', 'knowledge', 'runs', 'review', 'feedback']
      });

      return buildContextPack({
        taskGoal: request.taskGoal,
        agentRole: request.agentRole,
        riskLevel: request.riskLevel,
        query: request.query,
        items: results.map((result) => toRetrievalItem(result, sourcePolicy)),
        maxContextItems: request.maxContextItems,
        maxSectionChars: request.maxSectionChars
      });
    }
  };
}

function toRetrievalItem(
  result: Awaited<ReturnType<GlobalSearchRouteStore['search']>>[number],
  sourcePolicy: SourcePolicyDefaults
): RetrievalItem {
  return {
    id: result.id,
    entityKey: `${result.type}:${result.id}`,
    kind: toRetrievalKind(result.type),
    status: result.type === 'canon' ? 'Canon' : 'Draft',
    text: result.snippet,
    sourcePolicy: {
      allowedUse: isRestricted(result.id, sourcePolicy) ? [] : ['generation_support'],
      prohibitedUse: isRestricted(result.id, sourcePolicy) ? ['generation_support'] : []
    }
  };
}

function toRetrievalKind(type: GlobalSearchResultType): RetrievalItemKind {
  switch (type) {
    case 'canon':
      return 'memory';
    case 'manuscript':
      return 'manuscript';
    case 'review':
    case 'runs':
    case 'feedback':
      return 'review';
    case 'knowledge':
      return 'sample';
  }
}

function isRestricted(id: string, sourcePolicy: SourcePolicyDefaults): boolean {
  return sourcePolicy.restrictedSourceIds.includes(id);
}
