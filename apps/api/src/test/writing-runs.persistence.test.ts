import type { ProviderAdapter } from '@ai-novel/domain';
import { describe, expect, it } from 'vitest';
import { createPersistentApiRuntime } from '../runtime';

function fakeProvider(): ProviderAdapter {
  return {
    name: 'fake',
    async generateText() {
      return {
        text: 'The accepted test draft remains only a draft.',
        usage: { inputTokens: 10, outputTokens: 8 }
      };
    },
    async generateStructured<T>() {
      return {
        value: {
          summary: 'Passes contract',
          passed: true,
          findings: []
        } as T,
        usage: { inputTokens: 4, outputTokens: 3 }
      };
    },
    async *streamText() {
      yield 'unused';
    },
    async embedText() {
      return { vector: [0.1], model: 'fake-embedding' };
    },
    estimateCost(input) {
      return { estimatedUsd: (input.inputTokens + input.outputTokens) / 1_000_000 };
    }
  };
}

describe('persistent writing runs', () => {
  it('persists context, agent run, workflow run, artifacts, durable job, and llm logs', async () => {
    const runtime = await createPersistentApiRuntime(':memory:', {
      fallbackProvider: fakeProvider()
    });

    await seedProject(runtime.database.client);

    const response = await runtime.app.inject({
      method: 'POST',
      url: '/projects/project_seed/writing-runs',
      payload: {
        target: {
          manuscriptId: 'manuscript_seed',
          chapterId: 'chapter_seed',
          range: 'chapter_1'
        },
        contract: {
          authorshipLevel: 'A3',
          goal: 'Draft a traceable scene',
          mustWrite: 'Write one scene without promoting canon.',
          wordRange: { min: 100, max: 400 },
          forbiddenChanges: ['Do not alter canon'],
          acceptanceCriteria: ['Creates a draft artifact']
        },
        retrieval: {
          query: 'traceable scene',
          maxContextItems: 4,
          maxSectionChars: 1200
        }
      }
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body).toMatchObject({
      status: 'AwaitingAcceptance',
      manuscriptVersionId: null
    });
    expect(body.agentRunId).toMatch(/^agent_run_/);
    expect(body.durableJobId).toMatch(/^job_/);
    expect(body.workflowRunId).toMatch(/^workflow_run_/);
    expect(body.contextPack.id).toMatch(/^context_pack_/);
    expect(body.draftArtifact.artifactRecordId).toMatch(/^artifact_/);
    expect(body.selfCheckArtifact.artifactRecordId).toMatch(/^artifact_/);

    expect(await runtime.stores.agentRuns.agentRuns.findById(body.agentRunId)).toMatchObject({
      status: 'Succeeded',
      taskType: 'writing_draft',
      workflowType: 'writing.run'
    });
    expect(await runtime.stores.contextPacks.findById(body.contextPack.id)).toBeTruthy();
    expect(await runtime.stores.workflow.workflowRuns.findById(body.workflowRunId)).toBeTruthy();
    expect(await runtime.stores.workflow.durableJobs.findById(body.durableJobId)).toMatchObject({
      status: 'Succeeded'
    });
    expect(await runtime.stores.agentRuns.llmCallLogs.findByAgentRunId(body.agentRunId)).toHaveLength(2);

    runtime.database.client.close();
    await runtime.app.close();
  });

  it('blocks real external-provider writing runs when the project disables external models', async () => {
    const runtime = await createPersistentApiRuntime(':memory:', {
      env: { OPENAI_API_KEY: 'sk-local-test-secret' },
      providerSettings: {
        provider: 'openai',
        defaultModel: 'gpt-test',
        secretRef: 'env:OPENAI_API_KEY',
        redactedMetadata: {},
        updatedAt: '2026-04-28T00:00:00.000Z'
      },
      fetch: async () => {
        throw new Error('external provider should not be called');
      }
    });

    await seedProject(runtime.database.client, 'Disabled');

    const response = await runtime.app.inject({
      method: 'POST',
      url: '/projects/project_seed/writing-runs',
      payload: {
        target: {
          manuscriptId: 'manuscript_seed',
          chapterId: 'chapter_seed',
          range: 'chapter_1'
        },
        contract: {
          authorshipLevel: 'A3',
          goal: 'Draft a traceable scene',
          mustWrite: 'Write one scene without promoting canon.',
          wordRange: { min: 100, max: 400 },
          forbiddenChanges: ['Do not alter canon'],
          acceptanceCriteria: ['Creates a draft artifact']
        },
        retrieval: {
          query: 'traceable scene',
          maxContextItems: 4,
          maxSectionChars: 1200
        }
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: 'External model use is disabled for this project' });

    runtime.database.client.close();
    await runtime.app.close();
  });

  it('requires inspection for direct external-provider writing runs before calling the provider', async () => {
    let fetchCalls = 0;
    const runtime = await createPersistentApiRuntime(':memory:', {
      env: { OPENAI_API_KEY: 'sk-local-test-secret' },
      providerSettings: {
        provider: 'openai',
        defaultModel: 'gpt-test',
        secretRef: 'env:OPENAI_API_KEY',
        redactedMetadata: {},
        updatedAt: '2026-04-28T00:00:00.000Z'
      },
      fetch: async () => {
        fetchCalls += 1;
        throw new Error('external provider should not be called before inspection');
      }
    });

    await seedProject(runtime.database.client);

    const response = await runtime.app.inject({
      method: 'POST',
      url: '/projects/project_seed/writing-runs',
      payload: writingPayload()
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: 'Pre-send inspection is required for external writing runs',
      requiresInspection: true
    });
    expect(fetchCalls).toBe(0);

    runtime.database.client.close();
    await runtime.app.close();
  });

  it('prepares executes and cancels inspectable writing sends without external calls during prepare or cancel', async () => {
    const fetchCalls: Array<{ url: string; body: Record<string, unknown> }> = [];
    const runtime = await createPersistentApiRuntime(':memory:', {
      env: { OPENAI_API_KEY: 'sk-local-test-secret' },
      providerSettings: {
        provider: 'openai',
        defaultModel: 'gpt-test',
        secretRef: 'env:OPENAI_API_KEY',
        redactedMetadata: {},
        updatedAt: '2026-04-28T00:00:00.000Z'
      },
      fetch: async (url, init) => {
        const body = JSON.parse(String(init.body ?? '{}')) as Record<string, unknown>;
        fetchCalls.push({ url, body });
        const structured = body.response_format !== undefined;
        return jsonResponse({
          choices: [
            {
              message: {
                content: structured
                  ? JSON.stringify({ summary: 'Prepared run passes contract', passed: true, findings: [] })
                  : 'Prepared external draft uses the inspected context.'
              }
            }
          ],
          usage: { prompt_tokens: 21, completion_tokens: structured ? 9 : 15 }
        });
      }
    });

    await seedProject(runtime.database.client);

    const prepareResponse = await runtime.app.inject({
      method: 'POST',
      url: '/projects/project_seed/writing-runs/prepare',
      payload: writingPayload()
    });

    expect(prepareResponse.statusCode).toBe(201);
    expect(fetchCalls).toHaveLength(0);
    const prepared = prepareResponse.json();
    expect(prepared).toMatchObject({
      projectId: 'project_seed',
      status: 'Prepared',
      confirmationRequired: true,
      provider: {
        provider: 'openai',
        model: 'gpt-test',
        isExternal: true,
        secretConfigured: true
      },
      budgetEstimate: {
        inputTokens: expect.any(Number),
        outputTokens: expect.any(Number),
        estimatedCostUsd: expect.any(Number)
      },
      contextPack: {
        taskGoal: 'Draft a traceable scene',
        retrievalTrace: expect.arrayContaining(['query:traceable scene'])
      },
      blockingReasons: []
    });

    expect(await runtime.stores.agentRuns.llmCallLogs.findByAgentRunId(prepared.agentRunId)).toHaveLength(0);

    const cancelPrepareResponse = await runtime.app.inject({
      method: 'POST',
      url: '/projects/project_seed/writing-runs/prepare',
      payload: writingPayload({ goal: 'Prepare and cancel a traceable scene' })
    });
    expect(cancelPrepareResponse.statusCode).toBe(201);
    const cancelledPrepared = cancelPrepareResponse.json();
    const cancelResponse = await runtime.app.inject({
      method: 'POST',
      url: `/projects/project_seed/writing-runs/${cancelledPrepared.id}/cancel`,
      payload: { cancelledBy: 'vitest' }
    });
    expect(cancelResponse.statusCode).toBe(200);
    expect(cancelResponse.json()).toMatchObject({ id: cancelledPrepared.id, status: 'Cancelled' });
    expect(await runtime.stores.agentRuns.llmCallLogs.findByAgentRunId(cancelledPrepared.agentRunId)).toHaveLength(0);

    const cancelledExecuteResponse = await runtime.app.inject({
      method: 'POST',
      url: `/projects/project_seed/writing-runs/${cancelledPrepared.id}/execute`,
      payload: { confirmed: true, confirmedBy: 'vitest' }
    });
    expect(cancelledExecuteResponse.statusCode).toBe(409);

    const executeWithoutConfirmation = await runtime.app.inject({
      method: 'POST',
      url: `/projects/project_seed/writing-runs/${prepared.id}/execute`,
      payload: { confirmed: false }
    });
    expect(executeWithoutConfirmation.statusCode).toBe(409);
    expect(fetchCalls).toHaveLength(0);

    const executeResponse = await runtime.app.inject({
      method: 'POST',
      url: `/projects/project_seed/writing-runs/${prepared.id}/execute`,
      payload: { confirmed: true, confirmedBy: 'vitest' }
    });

    expect(executeResponse.statusCode).toBe(201);
    expect(fetchCalls).toHaveLength(2);
    const executed = executeResponse.json();
    expect(executed).toMatchObject({
      id: prepared.agentRunId,
      agentRunId: prepared.agentRunId,
      contextPack: { id: prepared.contextPack.id },
      draftArtifact: {
        text: 'Prepared external draft uses the inspected context.',
        artifactRecordId: expect.stringMatching(/^artifact_/)
      }
    });
    expect(await runtime.stores.agentRuns.llmCallLogs.findByAgentRunId(prepared.agentRunId)).toHaveLength(2);
    expect(await runtime.stores.workflow.durableJobs.findById(prepared.id)).toMatchObject({
      status: 'Succeeded',
      payload: expect.objectContaining({
        confirmedBy: 'vitest',
        workflowRunId: executed.workflowRunId
      })
    });

    runtime.database.client.close();
    await runtime.app.close();
  });
});

async function seedProject(client: { execute(sql: string): Promise<unknown> }, externalModelPolicy = 'Allowed') {
  await client.execute(`INSERT INTO projects (id, title, language, status, reader_contract_json, created_at, updated_at) VALUES (
    'project_seed', 'Seed Project', 'zh-CN', 'Active', '{}', '2026-04-28T00:00:00.000Z', '2026-04-28T00:00:00.000Z'
  )`);
  await client.execute(`UPDATE projects SET external_model_policy = '${externalModelPolicy}' WHERE id = 'project_seed'`);
}

function writingPayload(overrides: { goal?: string } = {}) {
  return {
    target: {
      manuscriptId: 'manuscript_seed',
      chapterId: 'chapter_seed',
      range: 'chapter_1'
    },
    contract: {
      authorshipLevel: 'A3',
      goal: overrides.goal ?? 'Draft a traceable scene',
      mustWrite: 'Write one scene without promoting canon.',
      wordRange: { min: 100, max: 400 },
      forbiddenChanges: ['Do not alter canon'],
      acceptanceCriteria: ['Creates a draft artifact']
    },
    retrieval: {
      query: 'traceable scene',
      maxContextItems: 4,
      maxSectionChars: 1200
    }
  };
}

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body)
  } as Response;
}
