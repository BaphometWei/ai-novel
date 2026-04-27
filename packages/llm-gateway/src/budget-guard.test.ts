import { describe, expect, it } from 'vitest';
import type { ProviderAdapter } from '@ai-novel/domain';
import { LlmGateway } from './gateway';

describe('LLM budget guard', () => {
  it('blocks a model call before provider execution when estimated cost exceeds the run budget', async () => {
    let providerCalled = false;
    const provider: ProviderAdapter = {
      name: 'budget-test',
      async generateText() {
        providerCalled = true;
        return { text: 'unused', usage: { inputTokens: 1, outputTokens: 1 } };
      },
      async generateStructured<T>() {
        providerCalled = true;
        return { value: {} as T, usage: { inputTokens: 1, outputTokens: 1 } };
      },
      async *streamText() {
        providerCalled = true;
        yield 'unused';
      },
      async embedText() {
        providerCalled = true;
        return { vector: [], model: 'fake' };
      },
      estimateCost() {
        return { estimatedUsd: 1 };
      }
    };
    const gateway = new LlmGateway({
      provider,
      defaultModel: 'expensive-model',
      budget: { maxRunCostUsd: 0.0001, defaultMaxOutputTokens: 1000 }
    });

    await expect(gateway.generateText({ prompt: 'expensive' })).rejects.toThrow(/budget/i);
    expect(providerCalled).toBe(false);
    expect(gateway.callLog[0]).toMatchObject({
      provider: 'budget-test',
      model: 'expensive-model',
      usage: { inputTokens: 3, outputTokens: 1000 },
      estimatedCostUsd: 1,
      status: 'Failed',
      error: 'LLM budget exceeded: estimated 1.000000 USD exceeds 0.000100 USD'
    });
  });

  it('blocks embedding calls before provider execution when estimated cost exceeds the run budget', async () => {
    let providerCalled = false;
    const provider: ProviderAdapter = {
      name: 'embedding-budget-test',
      async generateText() {
        return { text: 'unused', usage: { inputTokens: 1, outputTokens: 1 } };
      },
      async generateStructured<T>() {
        return { value: {} as T, usage: { inputTokens: 1, outputTokens: 1 } };
      },
      async *streamText() {
        yield 'unused';
      },
      async embedText() {
        providerCalled = true;
        return { vector: [0.1], model: 'embedding-test' };
      },
      estimateCost() {
        return { estimatedUsd: 1 };
      }
    };
    const gateway = new LlmGateway({
      provider,
      defaultModel: 'embedding-test',
      budget: { maxRunCostUsd: 0.0001 }
    });

    await expect(gateway.embedText({ text: 'expensive embedding' })).rejects.toThrow(/budget/i);
    expect(providerCalled).toBe(false);
    expect(gateway.callLog[0]).toMatchObject({
      provider: 'embedding-budget-test',
      model: 'embedding-test',
      usage: { inputTokens: 5, outputTokens: 0 },
      estimatedCostUsd: 1,
      status: 'Failed',
      error: 'LLM budget exceeded: estimated 1.000000 USD exceeds 0.000100 USD'
    });
  });
});
