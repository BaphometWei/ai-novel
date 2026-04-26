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
});
