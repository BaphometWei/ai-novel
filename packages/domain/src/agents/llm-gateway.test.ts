import { describe, expect, it } from 'vitest';
import { createLlmCallRecord, defineProviderAdapter, type ProviderAdapter } from './llm-gateway';

describe('ProviderAdapter contract', () => {
  it('supports text, structured output, streaming, embeddings, and cost estimation', async () => {
    const adapter = defineProviderAdapter({
      generateText: async () => ({ text: 'draft', usage: { inputTokens: 1, outputTokens: 1 } }),
      generateStructured: async <T>() => ({
        value: { title: 'Chapter' } as T,
        usage: { inputTokens: 1, outputTokens: 1 }
      }),
      streamText: async function* () {
        yield 'draft';
      },
      embedText: async () => ({ vector: [0.1, 0.2], model: 'fake-embedding' }),
      estimateCost: () => ({ estimatedUsd: 0.01 })
    } satisfies ProviderAdapter);

    await expect(adapter.generateText({ prompt: 'x' })).resolves.toMatchObject({ text: 'draft' });
    await expect(adapter.generateStructured<{ title: string }>({
      prompt: 'x',
      schemaName: 'chapter'
    })).resolves.toMatchObject({ value: { title: 'Chapter' } });
    await expect(adapter.embedText({ text: 'x' })).resolves.toMatchObject({ model: 'fake-embedding' });
    expect(adapter.estimateCost({ inputTokens: 1, outputTokens: 1 })).toEqual({ estimatedUsd: 0.01 });
  });

  it('creates durable LLM call records for observability persistence', () => {
    const record = createLlmCallRecord({
      agentRunId: 'agent_run_abc',
      promptVersionId: 'prompt_v1',
      provider: 'fake',
      model: 'fake-model',
      schemaName: 'ChapterPlan',
      usage: { inputTokens: 100, outputTokens: 40 },
      durationMs: 250,
      estimatedCostUsd: 0.0014,
      retryCount: 1,
      status: 'Succeeded'
    });

    expect(record.id).toMatch(/^llm_call_/);
    expect(record.createdAt).toMatch(/T/);
    expect(record).toMatchObject({
      agentRunId: 'agent_run_abc',
      promptVersionId: 'prompt_v1',
      provider: 'fake',
      model: 'fake-model',
      usage: { inputTokens: 100, outputTokens: 40 },
      retryCount: 1,
      status: 'Succeeded'
    });
  });
});
