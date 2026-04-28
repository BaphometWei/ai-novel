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
});

async function seedProject(client: { execute(sql: string): Promise<unknown> }) {
  await client.execute(`INSERT INTO projects (id, title, language, status, reader_contract_json, created_at, updated_at) VALUES (
    'project_seed', 'Seed Project', 'zh-CN', 'Active', '{}', '2026-04-28T00:00:00.000Z', '2026-04-28T00:00:00.000Z'
  )`);
}
