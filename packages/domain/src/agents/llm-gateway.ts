export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface ProviderAdapter {
  name?: string;
  generateText(input: { prompt: string; model?: string }): Promise<{ text: string; usage: TokenUsage }>;
  generateStructured<T>(input: {
    prompt: string;
    schemaName: string;
    model?: string;
  }): Promise<{ value: T; usage: TokenUsage }>;
  streamText(input: { prompt: string; model?: string }): AsyncIterable<string>;
  embedText(input: { text: string; model?: string }): Promise<{ vector: number[]; model: string }>;
  estimateCost(input: { model?: string; inputTokens: number; outputTokens: number }): { estimatedUsd: number };
}

export function defineProviderAdapter(adapter: ProviderAdapter): ProviderAdapter {
  return adapter;
}
