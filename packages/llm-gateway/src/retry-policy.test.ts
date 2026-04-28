import type { ProviderAdapter } from '@ai-novel/domain';
import { describe, expect, it, vi } from 'vitest';
import { LlmGateway } from './gateway';

function createRetryProvider(input?: {
  estimateCost?: ProviderAdapter['estimateCost'];
  generateText?: ProviderAdapter['generateText'];
}): ProviderAdapter {
  return {
    name: 'fake',
    generateText:
      input?.generateText ??
      (async () => ({
        text: 'ok',
        usage: { inputTokens: 10, outputTokens: 10 }
      })),
    async generateStructured<T>() {
      return { value: {} as T, usage: { inputTokens: 1, outputTokens: 1 } };
    },
    async *streamText() {
      yield 'ok';
    },
    async embedText() {
      return { vector: [0.1], model: 'fake-model' };
    },
    estimateCost: input?.estimateCost ?? (() => ({ estimatedUsd: 0.01 }))
  };
}

describe('LlmGateway retry and budget policy', () => {
  it('retries transient 429 failures, logs attempts, redacts errors, and records retry count', async () => {
    const generateText = vi
      .fn<Parameters<ProviderAdapter['generateText']>, ReturnType<ProviderAdapter['generateText']>>()
      .mockRejectedValueOnce(new Error('429 api_key secret-123'))
      .mockResolvedValueOnce({ text: 'ok', usage: { inputTokens: 10, outputTokens: 10 } });
    const provider = createRetryProvider({ generateText });

    const gateway = new LlmGateway({
      provider,
      defaultModel: 'fake-model',
      promptVersionId: 'prompt_default',
      retryPolicy: { maxAttempts: 2, baseDelayMs: 0 },
      budgetPolicy: { maxRunCostUsd: 1 }
    });

    await expect(gateway.generateText({ prompt: 'hello' })).resolves.toMatchObject({ text: 'ok' });

    expect(generateText).toHaveBeenCalledTimes(2);
    expect(gateway.callLog).toHaveLength(1);
    expect(gateway.callLog[0]).toMatchObject({
      status: 'Succeeded',
      retryCount: 1
    });
    expect(JSON.stringify(gateway.callLog)).not.toContain('secret-123');
  });

  it('retries transient 5xx and timeout failures before surfacing a redacted final error', async () => {
    const timeout = new Error('Request timeout with Bearer sk-timeout-secret');
    timeout.name = 'TimeoutError';
    const generateText = vi
      .fn<Parameters<ProviderAdapter['generateText']>, ReturnType<ProviderAdapter['generateText']>>()
      .mockRejectedValueOnce(new Error('OpenAI request failed with status 503 apiKey=server-secret'))
      .mockRejectedValueOnce(timeout)
      .mockRejectedValueOnce(new Error('500 api_key final-secret'));
    const provider = createRetryProvider({ generateText });

    const gateway = new LlmGateway({
      provider,
      defaultModel: 'fake-model',
      retryPolicy: { maxAttempts: 3, baseDelayMs: 0 },
      budgetPolicy: { maxRunCostUsd: 1 }
    });

    await expect(gateway.generateText({ prompt: 'hello' })).rejects.toThrow('500 api_key [REDACTED]');

    expect(generateText).toHaveBeenCalledTimes(3);
    expect(gateway.callLog).toHaveLength(1);
    expect(gateway.callLog[0]).toMatchObject({
      status: 'Failed',
      retryCount: 2,
      error: '500 api_key [REDACTED]'
    });
    expect(JSON.stringify(gateway.callLog)).not.toContain('server-secret');
    expect(JSON.stringify(gateway.callLog)).not.toContain('sk-timeout-secret');
    expect(JSON.stringify(gateway.callLog)).not.toContain('final-secret');
  });

  it('enforces maxRunCostUsd cumulatively after retries', async () => {
    const generateText = vi
      .fn<Parameters<ProviderAdapter['generateText']>, ReturnType<ProviderAdapter['generateText']>>()
      .mockRejectedValueOnce(new Error('429 retry me'))
      .mockResolvedValueOnce({ text: 'too expensive', usage: { inputTokens: 10, outputTokens: 10 } });
    const provider = createRetryProvider({
      generateText,
      estimateCost: () => ({ estimatedUsd: 0.02 })
    });

    const gateway = new LlmGateway({
      provider,
      defaultModel: 'fake-model',
      retryPolicy: { maxAttempts: 2, baseDelayMs: 0 },
      budgetPolicy: { maxRunCostUsd: 0.03 }
    });

    await expect(gateway.generateText({ prompt: 'hello' })).rejects.toThrow(/budget exceeded/i);

    expect(generateText).toHaveBeenCalledTimes(2);
    expect(gateway.callLog).toHaveLength(1);
    expect(gateway.callLog[0]).toMatchObject({
      status: 'Failed',
      retryCount: 1,
      estimatedCostUsd: 0.04
    });
  });
});
