import {
  canUseForGeneration,
  memoryStatusRank,
  normalizeTerms,
  scoreRetrievalItem,
  type RetrievalItem
} from './retrieval-policy';

export interface RerankRetrievalItemsInput {
  query: string;
  items: RetrievalItem[];
  now?: string;
}

export interface RankedRetrievalItem {
  item: RetrievalItem;
  score: number;
  reasons: string[];
}

export interface ExcludedRetrievalItem {
  itemId: string;
  reason: string;
}

export interface RetrievalRerankResult {
  included: RankedRetrievalItem[];
  excluded: ExcludedRetrievalItem[];
  trace: Array<{ itemId: string; score: number; reasons: string[] }>;
}

export function rerankRetrievalItems(input: RerankRetrievalItemsInput): RetrievalRerankResult {
  const excluded: ExcludedRetrievalItem[] = [];
  const included: RankedRetrievalItem[] = [];

  for (const item of input.items) {
    const exclusionReason = getExclusionReason(item);
    if (exclusionReason) {
      excluded.push({ itemId: item.id, reason: exclusionReason });
      continue;
    }

    const ranked = scoreItem(item, input.query, input.now);
    included.push(ranked);
  }

  included.sort(
    (left, right) =>
      right.score - left.score ||
      memoryStatusRank(right.item.status) - memoryStatusRank(left.item.status) ||
      left.item.id.localeCompare(right.item.id)
  );

  return {
    included,
    excluded,
    trace: included.map(({ item, score, reasons }) => ({ itemId: item.id, score, reasons }))
  };
}

function getExclusionReason(item: RetrievalItem): string | undefined {
  if (item.status === 'Conflict' || item.status === 'Deprecated') {
    return `negative_memory:${item.status}`;
  }

  if (!canUseForGeneration(item)) {
    return 'restricted_source_policy:generation_support';
  }

  return undefined;
}

function scoreItem(item: RetrievalItem, query: string, now?: string): RankedRetrievalItem {
  const reasons: string[] = [`status:${item.status}`];
  let score = scoreRetrievalItem(item, query);

  if (item.status === 'Canon') {
    score += 400;
  }

  if (isRecent(item, now)) {
    score += 300;
    reasons.push('recent');
  }

  if (item.authoritative) {
    score += 200;
    reasons.push('authoritative');
  }

  if (item.promise) {
    score += 100;
    reasons.push('promise');
  }

  const queryMatches = matchingTerms(query, item.text);
  if (queryMatches.length > 0) {
    reasons.push(`query:${queryMatches.join(',')}`);
  }

  return { item, score, reasons };
}

function isRecent(item: RetrievalItem, now?: string): boolean {
  if (!item.updatedAt || !now) return false;

  const updatedAtMs = Date.parse(item.updatedAt);
  const nowMs = Date.parse(now);
  if (!Number.isFinite(updatedAtMs) || !Number.isFinite(nowMs)) return false;

  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  return nowMs - updatedAtMs >= 0 && nowMs - updatedAtMs <= thirtyDaysMs;
}

function matchingTerms(query: string, text: string): string[] {
  const textTerms = new Set(normalizeTerms(text));
  return normalizeTerms(query).filter((term) => textTerms.has(term));
}
