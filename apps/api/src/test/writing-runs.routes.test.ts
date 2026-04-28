import { createContextPack, type ProviderAdapter } from '@ai-novel/domain';
import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
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

  it('routes prepared writing sends through persistent service dependencies', async () => {
    const app = Fastify();
    const service = {
      start: vi.fn(),
      prepare: vi.fn(async () => ({
        id: 'job_prepared_1',
        projectId: 'project_abc',
        agentRunId: 'agent_run_prepared_1',
        status: 'Prepared',
        confirmationRequired: true,
        provider: {
          provider: 'fake',
          model: 'fake-model',
          isExternal: false,
          secretConfigured: true
        },
        budgetEstimate: {
          inputTokens: 25,
          outputTokens: 0,
          estimatedCostUsd: 0
        },
        warnings: [],
        blockingReasons: [],
        expiresAt: '2026-04-28T01:00:00.000Z',
        contextPack: createContextPack({
          taskGoal: 'Draft the clocktower confrontation.',
          agentRole: 'Writer',
          riskLevel: 'Medium',
          sections: [{ name: 'retrieved_context', content: 'Prepared local context.' }],
          citations: [],
          exclusions: [],
          warnings: [],
          retrievalTrace: ['query:Mara courier clocktower']
        })
      })),
      executePrepared: vi.fn(async () => ({
        id: 'agent_run_prepared_1',
        status: 'AwaitingAcceptance',
        manuscriptVersionId: null,
        draftArtifact: {
          id: 'artifact_draft_prepared',
          type: 'draft_prose',
          status: 'Draft',
          text: 'Prepared draft.',
          contextPackId: 'context_pack_prepared'
        },
        selfCheckArtifact: {
          id: 'artifact_self_check_prepared',
          type: 'self_check',
          status: 'Completed',
          result: { summary: 'Prepared draft passes.', passed: true, findings: [] }
        },
        contextPack: createContextPack({
          taskGoal: 'Draft the clocktower confrontation.',
          agentRole: 'Writer',
          riskLevel: 'Medium',
          sections: [],
          citations: [],
          exclusions: [],
          warnings: [],
          retrievalTrace: []
        })
      })),
      cancelPrepared: vi.fn(async () => ({
        id: 'job_prepared_1',
        projectId: 'project_abc',
        agentRunId: 'agent_run_prepared_1',
        status: 'Cancelled',
        confirmationRequired: true,
        provider: {
          provider: 'fake',
          model: 'fake-model',
          isExternal: false,
          secretConfigured: true
        },
        budgetEstimate: { inputTokens: 25, outputTokens: 0, estimatedCostUsd: 0 },
        warnings: [],
        blockingReasons: [],
        expiresAt: '2026-04-28T01:00:00.000Z',
        contextPack: createContextPack({
          taskGoal: 'Draft the clocktower confrontation.',
          agentRole: 'Writer',
          riskLevel: 'Medium',
          sections: [],
          citations: [],
          exclusions: [],
          warnings: [],
          retrievalTrace: []
        })
      }))
    };

    registerWritingRunRoutes(app, service as never);

    const payload = {
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
      }
    };

    const prepare = await app.inject({
      method: 'POST',
      url: '/projects/project_abc/writing-runs/prepare',
      payload
    });
    expect(prepare.statusCode).toBe(201);
    expect(service.prepare).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'project_abc' }));
    expect(prepare.json()).toMatchObject({ id: 'job_prepared_1', status: 'Prepared' });

    const execute = await app.inject({
      method: 'POST',
      url: '/projects/project_abc/writing-runs/job_prepared_1/execute',
      payload: { confirmed: true, confirmedBy: 'vitest' }
    });
    expect(execute.statusCode).toBe(201);
    expect(service.executePrepared).toHaveBeenCalledWith('project_abc', 'job_prepared_1', {
      confirmed: true,
      confirmedBy: 'vitest'
    });

    const cancel = await app.inject({
      method: 'POST',
      url: '/projects/project_abc/writing-runs/job_prepared_1/cancel',
      payload: { cancelledBy: 'vitest' }
    });
    expect(cancel.statusCode).toBe(200);
    expect(service.cancelPrepared).toHaveBeenCalledWith('project_abc', 'job_prepared_1', { cancelledBy: 'vitest' });
    await app.close();
  });
});
