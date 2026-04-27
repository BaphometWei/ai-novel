import { describe, expect, it } from 'vitest';
import { createFakeProvider } from './fake-provider';
import { LlmGateway } from './gateway';

describe('LlmGateway', () => {
  it('routes text, structured output, embeddings, and cost estimation through one provider', async () => {
    const gateway = new LlmGateway({
      provider: createFakeProvider({
        text: 'draft text',
        structured: { title: 'Chapter One' },
        embedding: [0.1, 0.2, 0.3]
      }),
      defaultModel: 'fake-model'
    });

    await expect(gateway.generateText({ prompt: 'Draft a scene' })).resolves.toMatchObject({
      text: 'draft text'
    });
    await expect(gateway.generateStructured<{ title: string }>({ prompt: 'Plan chapter', schemaName: 'ChapterPlan' }))
      .resolves.toMatchObject({ value: { title: 'Chapter One' } });
    await expect(gateway.embedText({ text: 'Hero is injured.' })).resolves.toMatchObject({
      vector: [0.1, 0.2, 0.3],
      model: 'fake-model'
    });
    expect(gateway.estimateCost({ inputTokens: 100, outputTokens: 50 })).toEqual({ estimatedUsd: 0.00015 });
  });

  it('validates structured output, records repair attempts, and logs model usage metadata', async () => {
    const provider = createFakeProvider({
      text: 'draft text',
      structuredSequence: [{ title: 42 }, { title: 'Chapter One' }],
      embedding: [0.1]
    });
    const gateway = new LlmGateway({
      provider,
      defaultModel: 'fake-model',
      promptVersionId: 'prompt_chapter_plan_v1'
    });

    const result = await gateway.generateStructured<{ title: string }>({
      prompt: 'Plan chapter',
      schemaName: 'ChapterPlan',
      validate: (value) => typeof value === 'object' && value !== null && typeof (value as { title?: unknown }).title === 'string'
    });

    expect(result.value).toEqual({ title: 'Chapter One' });
    expect(result.repairAttempts).toEqual([{ attempt: 1, reason: 'Schema validation failed for ChapterPlan' }]);
    expect(gateway.callLog[0]).toMatchObject({
      promptVersionId: 'prompt_chapter_plan_v1',
      provider: 'fake',
      model: 'fake-model',
      schemaName: 'ChapterPlan',
      retryCount: 1
    });
    expect(gateway.callLog[0]?.usage).toEqual({ inputTokens: 1, outputTokens: 1 });
    expect(gateway.callLog[0]?.estimatedCostUsd).toBe(0.000002);
    expect(gateway.callLog[0]?.durationMs).toBeGreaterThanOrEqual(0);
    expect(provider.structuredPrompts[1]).toContain('Repair structured output for ChapterPlan');
  });

  it('logs failed structured validation calls with repair metadata before throwing', async () => {
    const gateway = new LlmGateway({
      provider: createFakeProvider({
        text: 'draft text',
        structuredSequence: [{ title: 42 }, { title: 43 }],
        embedding: [0.1]
      }),
      defaultModel: 'fake-model',
      promptVersionId: 'prompt_chapter_plan_v1'
    });

    await expect(
      gateway.generateStructured<{ title: string }>({
        prompt: 'Plan chapter',
        schemaName: 'ChapterPlan',
        validate: (value) => typeof value === 'object' && value !== null && typeof (value as { title?: unknown }).title === 'string'
      })
    ).rejects.toThrow(/Structured output failed validation/);

    expect(gateway.callLog[0]).toMatchObject({
      promptVersionId: 'prompt_chapter_plan_v1',
      provider: 'fake',
      model: 'fake-model',
      schemaName: 'ChapterPlan',
      retryCount: 2,
      status: 'Failed',
      error: 'Structured output failed validation for ChapterPlan'
    });
  });

  it('logs failed text generation provider calls before rethrowing', async () => {
    const provider = createFakeProvider({
      text: 'unused',
      structured: {},
      embedding: [0.1]
    });
    const providerError = new Error('provider unavailable');
    provider.generateText = async () => {
      throw providerError;
    };
    const gateway = new LlmGateway({
      provider,
      defaultModel: 'fake-model',
      promptVersionId: 'writer.v2.1'
    });

    await expect(gateway.generateText({ prompt: 'Draft a scene' })).rejects.toBe(providerError);

    expect(gateway.callLog[0]).toMatchObject({
      promptVersionId: 'writer.v2.1',
      provider: 'fake',
      model: 'fake-model',
      usage: { inputTokens: 4, outputTokens: 0 },
      status: 'Failed',
      error: 'provider unavailable'
    });
  });

  it('logs failed structured provider calls before rethrowing', async () => {
    const provider = createFakeProvider({
      text: 'unused',
      structured: {},
      embedding: [0.1]
    });
    const providerError = new Error('invalid JSON from provider');
    provider.generateStructured = async () => {
      throw providerError;
    };
    const gateway = new LlmGateway({
      provider,
      defaultModel: 'fake-model',
      promptVersionId: 'writer.v2.1'
    });

    await expect(
      gateway.generateStructured<{ title: string }>({
        prompt: 'Plan chapter',
        schemaName: 'ChapterPlan'
      })
    ).rejects.toBe(providerError);

    expect(gateway.callLog[0]).toMatchObject({
      promptVersionId: 'writer.v2.1',
      provider: 'fake',
      model: 'fake-model',
      schemaName: 'ChapterPlan',
      usage: { inputTokens: 3, outputTokens: 0 },
      status: 'Failed',
      error: 'invalid JSON from provider'
    });
  });

  it('logs failed embedding provider calls before rethrowing', async () => {
    const provider = createFakeProvider({
      text: 'unused',
      structured: {},
      embedding: [0.1]
    });
    const providerError = new Error('embedding provider unavailable');
    provider.embedText = async () => {
      throw providerError;
    };
    const gateway = new LlmGateway({
      provider,
      defaultModel: 'fake-model',
      promptVersionId: 'writer.v2.1'
    });

    await expect(gateway.embedText({ text: 'Hero is injured.' })).rejects.toBe(providerError);

    expect(gateway.callLog[0]).toMatchObject({
      promptVersionId: 'writer.v2.1',
      provider: 'fake',
      model: 'fake-model',
      usage: { inputTokens: 4, outputTokens: 0 },
      status: 'Failed',
      error: 'embedding provider unavailable'
    });
  });

  it('logs failed streaming provider calls before yielding chunks and rethrows', async () => {
    const provider = createFakeProvider({
      text: 'unused',
      structured: {},
      embedding: [0.1]
    });
    const providerError = new Error('stream provider unavailable');
    provider.streamText = async function* () {
      throw providerError;
    };
    const gateway = new LlmGateway({
      provider,
      defaultModel: 'fake-model',
      promptVersionId: 'writer.v2.1'
    });

    const consume = async () => {
      for await (const _chunk of gateway.streamText({ prompt: 'Stream a scene' })) {
        // consume stream
      }
    };

    await expect(consume()).rejects.toBe(providerError);
    expect(gateway.callLog[0]).toMatchObject({
      promptVersionId: 'writer.v2.1',
      provider: 'fake',
      model: 'fake-model',
      usage: { inputTokens: 4, outputTokens: 0 },
      status: 'Failed',
      error: 'stream provider unavailable'
    });
  });

  it('logs failed streaming provider calls after yielding chunks and rethrows', async () => {
    const provider = createFakeProvider({
      text: 'unused',
      structured: {},
      embedding: [0.1]
    });
    const providerError = new Error('stream interrupted');
    provider.streamText = async function* () {
      yield { text: 'A B', usage: { inputTokens: 3, outputTokens: 4 } };
      throw providerError;
    };
    const gateway = new LlmGateway({
      provider,
      defaultModel: 'fake-model',
      promptVersionId: 'writer.v2.1'
    });
    const chunks: string[] = [];
    const consume = async () => {
      for await (const chunk of gateway.streamText({ prompt: 'continue' })) chunks.push(chunk);
    };

    await expect(consume()).rejects.toBe(providerError);
    expect(chunks.join('')).toBe('A B');
    expect(gateway.callLog[0]).toMatchObject({
      promptVersionId: 'writer.v2.1',
      provider: 'fake',
      model: 'fake-model',
      usage: { inputTokens: 3, outputTokens: 4 },
      status: 'Failed',
      error: 'stream interrupted'
    });
  });

  it('logs text, streaming, and embedding calls with prompt version, provider, model, usage, and cost', async () => {
    const gateway = new LlmGateway({
      provider: createFakeProvider({
        text: 'A B',
        structured: {},
        embedding: [0.1, 0.2],
        usage: { inputTokens: 3, outputTokens: 4 }
      }),
      defaultModel: 'fake-model',
      promptVersionId: 'writer.v2.1'
    });

    await expect(gateway.generateText({ prompt: 'continue' })).resolves.toMatchObject({ text: 'A B' });
    const chunks: string[] = [];
    for await (const chunk of gateway.streamText({ prompt: 'stream' })) chunks.push(chunk);
    await expect(gateway.embedText({ text: 'canon' })).resolves.toMatchObject({ vector: [0.1, 0.2] });

    expect(chunks.join('')).toBe('A B');
    expect(gateway.callLog).toEqual([
      expect.objectContaining({
        promptVersionId: 'writer.v2.1',
        provider: 'fake',
        model: 'fake-model',
        usage: { inputTokens: 3, outputTokens: 4 },
        estimatedCostUsd: 0.000007,
        status: 'Succeeded'
      }),
      expect.objectContaining({
        promptVersionId: 'writer.v2.1',
        provider: 'fake',
        model: 'fake-model',
        usage: { inputTokens: 3, outputTokens: 4 },
        estimatedCostUsd: 0.000007,
        status: 'Succeeded'
      }),
      expect.objectContaining({
        promptVersionId: 'writer.v2.1',
        provider: 'fake',
        model: 'fake-model',
        usage: { inputTokens: 2, outputTokens: 0 },
        estimatedCostUsd: 0.000002,
        status: 'Succeeded'
      })
    ]);
  });
});
