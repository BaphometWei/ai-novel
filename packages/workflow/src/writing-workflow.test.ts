import { describe, expect, it } from 'vitest';
import type { ContextPack, ProviderAdapter } from '@ai-novel/domain';
import { runWritingWorkflow, type WritingWorkflowInput } from './writing-workflow';

function writingRequest(overrides: Partial<WritingWorkflowInput> = {}): WritingWorkflowInput {
  return {
    projectId: 'project_abc',
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
      acceptanceCriteria: ['Keeps Mara in control', 'Preserves the courier mystery']
    },
    retrieval: {
      query: 'Mara courier clocktower',
      maxContextItems: 4
    },
    ...overrides
  };
}

function contextPack(): ContextPack {
  return {
    id: 'context_pack_abc',
    taskGoal: 'Draft the clocktower confrontation.',
    agentRole: 'Writer',
    riskLevel: 'Medium',
    sections: [{ name: 'retrieved_context', content: 'Mara fears bells. The courier limps.' }],
    citations: [{ sourceId: 'canon_1', quote: 'Mara fears bells.' }],
    exclusions: ['sample_restricted'],
    warnings: ['Excluded sample_restricted due to source policy'],
    retrievalTrace: ['query:Mara courier clocktower'],
    createdAt: '2026-04-27T00:00:00.000Z'
  };
}

function fakeProvider(): ProviderAdapter & { prompts: string[] } {
  const prompts: string[] = [];
  return {
    name: 'fake',
    prompts,
    async generateText(input) {
      prompts.push(input.prompt);
      return {
        text: 'Mara waited beneath the clocktower as the courier crossed the square.',
        usage: { inputTokens: 10, outputTokens: 12 }
      };
    },
    async generateStructured<T>(input: { prompt: string }) {
      prompts.push(input.prompt);
      return {
        value: {
          summary: 'Draft keeps the courier mystery intact.',
          passed: true,
          findings: ['Mara remains in control.']
        } as T,
        usage: { inputTokens: 8, outputTokens: 6 }
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

describe('runWritingWorkflow', () => {
  it('builds context through the injected builder and does not pass caller-provided sections into generation', async () => {
    const provider = fakeProvider();
    const builtContext = contextPack();
    const contextBuilderCalls: unknown[] = [];

    await runWritingWorkflow(writingRequest({
      unsafeCallerContextSections: [{ name: 'caller_context', content: 'This must not enter the prompt.' }]
    }), {
      provider,
      buildContext: async (input) => {
        contextBuilderCalls.push(input);
        return builtContext;
      }
    });

    expect(contextBuilderCalls).toEqual([
      expect.objectContaining({
        projectId: 'project_abc',
        taskGoal: 'Draft the clocktower confrontation.',
        agentRole: 'Writer',
        query: 'Mara courier clocktower',
        maxContextItems: 4
      })
    ]);
    expect(provider.prompts.join('\n')).toContain('Mara fears bells');
    expect(provider.prompts.join('\n')).not.toContain('This must not enter the prompt.');
  });

  it('creates draft and self-check artifacts and waits for author acceptance without creating a manuscript version', async () => {
    const result = await runWritingWorkflow(writingRequest(), {
      provider: fakeProvider(),
      buildContext: async () => contextPack()
    });

    expect(result.status).toBe('AwaitingAcceptance');
    expect(result.manuscriptVersionId).toBeNull();
    expect(result.draftArtifact).toMatchObject({
      type: 'draft_prose',
      status: 'Draft',
      text: expect.stringContaining('clocktower')
    });
    expect(result.selfCheckArtifact).toMatchObject({
      type: 'self_check',
      status: 'Completed',
      result: expect.objectContaining({ passed: true })
    });
    expect(result.review).toMatchObject({
      status: 'Completed',
      requiresAuthorAcceptance: true
    });
  });
});
