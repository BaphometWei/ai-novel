import { createContextPack, type ProviderAdapter } from '@ai-novel/domain';
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerWritingRunRoutes } from '../routes/writing-runs.routes';

function fakeProvider(): ProviderAdapter & { prompts: string[] } {
  const prompts: string[] = [];

  return {
    name: 'fake',
    prompts,
    async generateText(input) {
      prompts.push(input.prompt);
      return {
        text: 'Mara waited under the clocktower until the courier arrived.',
        usage: { inputTokens: 12, outputTokens: 10 }
      };
    },
    async generateStructured<T>(input: { prompt: string }) {
      prompts.push(input.prompt);
      return {
        value: {
          summary: 'The draft follows the contract.',
          passed: true,
          findings: []
        } as T,
        usage: { inputTokens: 8, outputTokens: 4 }
      };
    },
    async *streamText() {
      yield 'unused';
    },
    async embedText(input) {
      return { vector: [0.1], model: input.model ?? 'fake-embedding' };
    },
    estimateCost(input) {
      return { estimatedUsd: (input.inputTokens + input.outputTokens) / 1_000_000 };
    }
  };
}

describe('writing run API routes', () => {
  it('starts a writing workflow through injected dependencies and waits for acceptance without accepting a manuscript version', async () => {
    const app = Fastify();
    const provider = fakeProvider();
    const contextBuilderCalls: unknown[] = [];
    const builtContext = createContextPack({
      taskGoal: 'Draft the clocktower confrontation.',
      agentRole: 'Writer',
      riskLevel: 'Medium',
      sections: [{ name: 'retrieved_context', content: 'Mara fears bells. The courier limps.' }],
      citations: [{ sourceId: 'canon_1', quote: 'Mara fears bells.' }],
      exclusions: [],
      warnings: [],
      retrievalTrace: ['query:Mara courier clocktower']
    });

    registerWritingRunRoutes(app, {
      provider,
      buildContext: async (input) => {
        contextBuilderCalls.push(input);
        return builtContext;
      }
    });

    const response = await app.inject({
      method: 'POST',
      url: '/projects/project_abc/writing-runs',
      payload: {
        target: {
          manuscriptId: 'manuscript_abc',
          chapterId: 'chapter_abc',
          range: 'chapter_1_scene_2'
        },
        contract: {
          authorshipLevel: 'A3',
          goal: 'Draft the clocktower confrontation.',
          mustWrite: 'Mara corners the courier but lets him leave with a warning.',
          wordRange: { min: 600, max: 900 },
          forbiddenChanges: ['Do not reveal the courier identity'],
          acceptanceCriteria: ['Keeps Mara in control']
        },
        retrieval: {
          query: 'Mara courier clocktower',
          maxContextItems: 4,
          maxSectionChars: 1200
        },
        contextSections: [{ name: 'caller_context', content: 'This must not enter the prompt.' }]
      }
    });

    expect(response.statusCode).toBe(201);
    expect(contextBuilderCalls).toEqual([
      expect.objectContaining({
        projectId: 'project_abc',
        taskGoal: 'Draft the clocktower confrontation.',
        agentRole: 'Writer',
        riskLevel: 'Medium',
        query: 'Mara courier clocktower',
        maxContextItems: 4,
        maxSectionChars: 1200,
        target: expect.objectContaining({ manuscriptId: 'manuscript_abc' })
      })
    ]);

    const result = response.json();
    expect(result).toMatchObject({
      status: 'AwaitingAcceptance',
      manuscriptVersionId: null,
      contextPack: builtContext,
      draftArtifact: {
        type: 'draft_prose',
        status: 'Draft',
        text: expect.stringContaining('clocktower')
      },
      review: {
        status: 'Completed',
        requiresAuthorAcceptance: true
      }
    });
    expect(provider.prompts.join('\n')).toContain('Mara fears bells');
    expect(provider.prompts.join('\n')).not.toContain('This must not enter the prompt.');
    await app.close();
  });
});
