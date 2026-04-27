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
  updatedAt?: string;
  authoritative?: boolean;
  promise?: boolean;
}

export interface ContextBuildInput {
  taskGoal: string;
  agentRole: string;
  riskLevel: RiskLevel;
  query: string;
  items: RetrievalItem[];
  maxContextItems?: number;
  maxSectionChars?: number;
}

export function canUseForGeneration(item: RetrievalItem): boolean {
  if (item.status === 'Conflict' || item.status === 'Deprecated') {
    return false;
  }

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

export function scoreRetrievalItem(item: RetrievalItem, query: string): number {
  const queryTerms = normalizeTerms(query);
  const textTerms = normalizeTerms(item.text);
  const overlaps = queryTerms.filter((term) => textTerms.includes(term)).length;
  const kindWeight = item.kind === 'memory' ? 3 : item.kind === 'manuscript' ? 2 : item.kind === 'review' ? 1 : 0;
  const statusWeight = memoryStatusRank(item.status);
  const lengthPenalty = Math.min(2, Math.max(0, Math.floor(item.text.length / 240)));

  return overlaps * 10 + kindWeight * 2 + statusWeight - lengthPenalty;
}

export function compressText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const marker = '...';
  if (maxChars <= 0) return '';
  if (maxChars <= marker.length) return marker.slice(0, maxChars);
  const trimmed = text.slice(0, maxChars - marker.length).trimEnd();
  return `${trimmed}${marker}`;
}

export function normalizeTerms(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .map((term) => term.trim())
    .filter(Boolean);
}
