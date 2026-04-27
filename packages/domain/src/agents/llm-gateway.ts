import { systemClock } from '../shared/clock';
import { createId, type EntityId } from '../shared/ids';

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export type StreamTextChunk = string | { text: string; usage?: TokenUsage };

export type LlmCallStatus = 'Succeeded' | 'Failed';

export interface LlmCallRecord {
  id: EntityId<'llm_call'>;
  agentRunId: EntityId<'agent_run'>;
  promptVersionId: string;
  provider: string;
  model: string;
  schemaName?: string;
  usage: TokenUsage;
  durationMs: number;
  estimatedCostUsd: number;
  retryCount: number;
  status: LlmCallStatus;
  error?: string;
  createdAt: string;
}

export interface ProviderAdapter {
  name?: string;
  generateText(input: { prompt: string; model?: string }): Promise<{ text: string; usage: TokenUsage }>;
  generateStructured<T>(input: {
    prompt: string;
    schemaName: string;
    model?: string;
  }): Promise<{ value: T; usage: TokenUsage }>;
  streamText(input: { prompt: string; model?: string }): AsyncIterable<StreamTextChunk>;
  embedText(input: { text: string; model?: string }): Promise<{ vector: number[]; model: string }>;
  estimateCost(input: { model?: string; inputTokens: number; outputTokens: number }): { estimatedUsd: number };
}

export function defineProviderAdapter(adapter: ProviderAdapter): ProviderAdapter {
  return adapter;
}

export function createLlmCallRecord(input: Omit<LlmCallRecord, 'id' | 'createdAt'>): LlmCallRecord {
  return {
    id: createId('llm_call'),
    createdAt: systemClock.now(),
    ...input
  };
}
