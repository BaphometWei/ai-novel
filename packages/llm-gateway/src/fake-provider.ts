import type { ProviderAdapter, TokenUsage } from '@ai-novel/domain';

export interface FakeProviderOptions {
  text: string;
  structured: unknown;
  embedding: number[];
  usage?: TokenUsage;
}

export function createFakeProvider(options: FakeProviderOptions): ProviderAdapter {
  const usage = options.usage ?? { inputTokens: 1, outputTokens: 1 };

  return {
    async generateText() {
      return { text: options.text, usage };
    },
    async generateStructured<T>() {
      return { value: options.structured as T, usage };
    },
    async *streamText() {
      yield options.text;
    },
    async embedText(input) {
      return { vector: options.embedding, model: input.model ?? 'fake-model' };
    },
    estimateCost(input) {
      return { estimatedUsd: (input.inputTokens + input.outputTokens) / 1_000_000 };
    }
  };
}
