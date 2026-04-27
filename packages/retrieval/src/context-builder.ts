import { createContextPack } from '@ai-novel/domain';
import {
  canUseForGeneration,
  memoryStatusRank,
  type ContextBuildInput,
  type RetrievalItem
} from './retrieval-policy';
import { rerankRetrievalItems } from './reranker';
import { compressContextItems } from './context-compressor';

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

// use the reranker module to produce a ranked list and respect its exclusions/trace
function scoreAndSortItems(input: ContextBuildInput, items: RetrievalItem[]): RetrievalItem[] {
  const result = rerankRetrievalItems({ query: input.query, items, now: new Date().toISOString() });
  // return only included items in ranked order
  return result.included.map((r) => r.item);
}

// use the context-compressor to respect must-have and budget-based compression
function compressSelectedItems(items: RetrievalItem[], maxContextItems: number, maxSectionChars: number): RetrievalItem[] {
  const chosen = items.slice(0, maxContextItems);
  const result = compressContextItems({ items: chosen, maxSectionChars });
  return result.items;
}

export function buildContextPack(input: ContextBuildInput) {
  const exclusions: string[] = [];
  const warnings: string[] = [];
  const usable = input.items.filter((item) => {
    if (item.status === 'Conflict' || item.status === 'Deprecated') {
      exclusions.push(item.id);
      warnings.push(`Excluded ${item.id} because memory status is ${item.status}`);
      return false;
    }

    if (canUseForGeneration(item)) {
      return true;
    }

    exclusions.push(item.id);
    warnings.push(`Excluded ${item.id} due to source policy`);
    return false;
  });
  const ranked = scoreAndSortItems(input, usable);
  const selected = compressSelectedItems(
    selectBestByEntity(ranked),
    input.maxContextItems ?? 8,
    input.maxSectionChars ?? 1200
  );
  const content = selected.map((item) => item.text).join('\n');

  return createContextPack({
    taskGoal: input.taskGoal,
    agentRole: input.agentRole,
    riskLevel: input.riskLevel,
    sections: [{ name: 'retrieved_context', content }],
    citations: selected.map((item) => ({ sourceId: item.id, quote: item.text })),
    exclusions,
    warnings,
    retrievalTrace: [
      `query:${input.query}`,
      `ranked:${ranked.length}`,
      `selected:${selected.length}`,
      `excluded:${exclusions.length}`,
      `maxContextItems:${input.maxContextItems ?? 8}`,
      `maxSectionChars:${input.maxSectionChars ?? 1200}`
    ]
  });
}
