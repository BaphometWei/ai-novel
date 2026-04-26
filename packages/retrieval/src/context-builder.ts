import { createContextPack } from '@ai-novel/domain';
import { canUseForGeneration, memoryStatusRank, type ContextBuildInput, type RetrievalItem } from './retrieval-policy';

function selectBestByEntity(items: RetrievalItem[]): RetrievalItem[] {
  const best = new Map<string, RetrievalItem>();

  for (const item of items) {
    const current = best.get(item.entityKey);
    if (!current || memoryStatusRank(item.status) > memoryStatusRank(current.status)) {
      best.set(item.entityKey, item);
    }
  }

  return [...best.values()];
}

export function buildContextPack(input: ContextBuildInput) {
  const exclusions: string[] = [];
  const warnings: string[] = [];
  const usable = input.items.filter((item) => {
    if (canUseForGeneration(item)) {
      return true;
    }

    exclusions.push(item.id);
    warnings.push(`Excluded ${item.id} due to source policy`);
    return false;
  });
  const selected = selectBestByEntity(usable);
  const content = selected.map((item) => item.text).join('\n');

  return createContextPack({
    taskGoal: input.taskGoal,
    agentRole: input.agentRole,
    riskLevel: input.riskLevel,
    sections: [{ name: 'retrieved_context', content }],
    citations: selected.map((item) => ({ sourceId: item.id, quote: item.text })),
    exclusions,
    warnings,
    retrievalTrace: [`query:${input.query}`, `selected:${selected.length}`, `excluded:${exclusions.length}`]
  });
}
