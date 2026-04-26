import type { ProviderAdapter, TokenUsage } from '@ai-novel/domain';

export interface FakeProviderOptions {
  text: string;
  structured?: unknown;
  structuredSequence?: unknown[];
  embedding: number[];
  usage?: TokenUsage;
}

export type FakeProvider = ProviderAdapter & { structuredPrompts: string[] };

export function createFakeProvider(options: FakeProviderOptions): FakeProvider {
  const usage = options.usage ?? { inputTokens: 1, outputTokens: 1 };
  let structuredCallIndex = 0;
  const structuredPrompts: string[] = [];

  return {
    name: 'fake',
    structuredPrompts,
    async generateText() {
      return { text: options.text, usage };
    },
    async generateStructured<T>(input: { prompt: string }) {
      structuredPrompts.push(input.prompt);
      const structured = options.structuredSequence
        ? options.structuredSequence[Math.min(structuredCallIndex, options.structuredSequence.length - 1)]
        : options.structured;
      structuredCallIndex += 1;
      return { value: structured as T, usage };
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
