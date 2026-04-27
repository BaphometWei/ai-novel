import { describe, expect, it } from 'vitest';
import { createPersistentApiRuntime } from '../runtime';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
}

describe('persistent API runtime', () => {
  it('wires DB-backed agent run stores for the server runtime', async () => {
    const runtime = await createPersistentApiRuntime(':memory:');

    const response = await runtime.app.inject({
      method: 'POST',
      url: '/agent-runs/agent_run_missing/llm-calls',
      payload: {
        promptVersionId: 'prompt_v1',
        provider: 'fake',
        model: 'fake-model',
        usage: { inputTokens: 1, outputTokens: 1 },
        durationMs: 10,
        estimatedCostUsd: 0.000002,
        retryCount: 0,
        status: 'Succeeded'
      }
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: 'Agent run not found' });
    runtime.database.client.close();
  });

  it('seeds default prompt versions required by orchestration agent runs', async () => {
    const runtime = await createPersistentApiRuntime(':memory:');

    await expect(runtime.stores.promptVersions.findById('prompt_default')).resolves.toMatchObject({
      id: 'prompt_default',
      status: 'Active'
    });
    await expect(runtime.stores.promptVersions.findById('prompt_chapter_plan_v1')).resolves.toMatchObject({
      id: 'prompt_chapter_plan_v1',
      taskType: 'chapter_planning',
      provider: 'fake',
      model: 'fake-model',
      status: 'Active'
    });

    runtime.database.client.close();
  });

  it('runs persisted orchestration through configured OpenAI provider settings without exposing the secret', async () => {
    const rawApiKey = 'sk-runtime-secret';
    const seenRequests: Array<{ url: string; headers: Headers; body: unknown }> = [];
    const runtime = await createPersistentApiRuntime(':memory:', {
      env: { OPENAI_API_KEY: rawApiKey },
      fetch: async (url, init) => {
        seenRequests.push({
          url: String(url),
          headers: new Headers(init.headers),
          body: JSON.parse(String(init.body))
        });
        return jsonResponse({
          choices: [{ message: { content: '{"title":"Provider chapter","nextAction":"Revise with author"}' } }],
          usage: { prompt_tokens: 17, completion_tokens: 11 }
        });
      },
      providerSettings: {
        provider: 'openai',
        defaultModel: 'gpt-runtime',
        secretRef: 'env:OPENAI_API_KEY',
        redactedMetadata: {},
        updatedAt: '2026-04-27T06:00:00.000Z'
      },
      budgetPolicy: {
        provider: 'openai',
        maxRunCostUsd: 1,
        updatedAt: '2026-04-27T06:00:00.000Z'
      }
    });

    const projectResponse = await runtime.app.inject({
      method: 'POST',
      url: '/projects',
      payload: {
        title: 'OpenAI Night',
        language: 'en-US',
        targetAudience: 'serial fiction readers'
      }
    });
    const project = projectResponse.json();

    const response = await runtime.app.inject({
      method: 'POST',
      url: '/orchestration/runs',
      payload: {
        projectId: project.id,
        workflowType: 'chapter_creation',
        taskType: 'chapter_planning',
        agentRole: 'Planner',
        taskGoal: 'Plan the provider-backed chapter',
        riskLevel: 'Medium',
        outputSchema: 'ChapterPlan',
        promptVersionId: 'prompt_chapter_plan_v1',
        contextSections: [{ name: 'canon', content: 'The city is quiet.' }]
      }
    });

    expect(response.statusCode).toBe(201);
    const created = response.json();
    expect(created.output).toEqual({
      title: 'Provider chapter',
      nextAction: 'Revise with author'
    });
    expect(created.llmCalls[0]).toMatchObject({
      provider: 'openai',
      model: 'gpt-runtime',
      promptVersionId: 'prompt_chapter_plan_v1',
      schemaName: 'ChapterPlan',
      status: 'Succeeded'
    });
    expect(seenRequests[0]).toMatchObject({
      url: 'https://api.openai.com/v1/chat/completions',
      body: {
        model: 'gpt-runtime',
        response_format: { type: 'json_object' }
      }
    });
    expect(seenRequests[0]?.headers.get('authorization')).toBe(`Bearer ${rawApiKey}`);
    expect(JSON.stringify(created)).not.toContain(rawApiKey);
    await expect(runtime.stores.agentRuns.llmCallLogs.findByAgentRunId(created.agentRun.id)).resolves.toEqual(
      expect.arrayContaining([
        expect.not.objectContaining({
          provider: expect.stringContaining(rawApiKey),
          model: expect.stringContaining(rawApiKey),
          error: expect.stringContaining(rawApiKey)
        })
      ])
    );

    await runtime.app.close();
    runtime.database.client.close();
  });

  it('exposes persistent Agent Room approvals and durable job lineage for orchestration runs', async () => {
    const runtime = await createPersistentApiRuntime(':memory:');

    const projectResponse = await runtime.app.inject({
      method: 'POST',
      url: '/projects',
      payload: {
        title: 'Trace Project',
        language: 'en-US',
        targetAudience: 'serial fiction readers'
      }
    });
    const project = projectResponse.json();

    const orchestrationResponse = await runtime.app.inject({
      method: 'POST',
      url: '/orchestration/runs',
      payload: {
        projectId: project.id,
        workflowType: 'chapter_creation',
        taskType: 'chapter_planning',
        agentRole: 'Planner',
        taskGoal: 'Plan the traceable chapter',
        riskLevel: 'High',
        outputSchema: 'ChapterPlan',
        promptVersionId: 'prompt_chapter_plan_v1',
        contextSections: [{ name: 'canon', content: 'The archive bell wakes at dusk.' }]
      }
    });
    expect(orchestrationResponse.statusCode).toBe(201);
    const orchestration = orchestrationResponse.json();

    const governanceResponse = await runtime.app.inject({
      method: 'POST',
      url: '/governance/authorship-audit/inspect',
      payload: {
        projectId: project.id,
        source: { type: 'agent_run', id: orchestration.agentRun.id },
        actor: { type: 'agent', id: 'planner_agent' },
        action: 'promote_canon_fact',
        target: { canonFactId: 'canon_fact_trace' },
        transition: { from: 'DraftArtifact', to: 'CanonFact' },
        inspectedAt: '2026-04-27T12:00:00.000Z'
      }
    });
    expect(governanceResponse.statusCode).toBe(200);

    const detailResponse = await runtime.app.inject({
      method: 'GET',
      url: `/agent-room/runs/${orchestration.agentRun.id}`
    });

    expect(detailResponse.statusCode).toBe(200);
    expect(detailResponse.json()).toMatchObject({
      run: {
        id: orchestration.agentRun.id,
        jobStatus: 'Succeeded',
        pendingApprovalCount: 1
      },
      contextPack: { id: orchestration.contextPack.id },
      workflowRun: { id: orchestration.workflowRun.id },
      approvals: [
        {
          status: 'Pending',
          riskLevel: 'High',
          title: 'Agent-authored canon mutations require approval before changing canon state'
        }
      ],
      durableJob: {
        id: orchestration.job.id,
        status: 'Succeeded',
        retryCount: 0,
        lineage: [orchestration.job.id]
      }
    });

    await runtime.app.close();
    runtime.database.client.close();
  });

  it('fails closed when OpenAI is configured but the env secret is missing', async () => {
    await expect(
      createPersistentApiRuntime(':memory:', {
        env: {},
        providerSettings: {
          provider: 'openai',
          defaultModel: 'gpt-runtime',
          secretRef: 'env:OPENAI_API_KEY',
          redactedMetadata: {},
          updatedAt: '2026-04-27T06:00:00.000Z'
        }
      })
    ).rejects.toThrow('Missing provider secret: env:OPENAI_API_KEY');
  });
});
