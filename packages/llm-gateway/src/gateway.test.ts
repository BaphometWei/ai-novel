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
});
