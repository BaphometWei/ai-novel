import { createAgentRun, createArtifactRecord, createContextPack, createLlmCallRecord } from '@ai-novel/domain';
import type { AgentRoomActionRepositories, AgentRoomRepositories, DurableJob } from '@ai-novel/workflow';
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerAgentRoomRoutes } from '../routes/agent-room.routes';

const contextPackId = 'context_pack_room' as const;
const agentRunId = 'agent_run_room' as const;
const artifactId = 'artifact_scene' as const;
const llmCallId = 'llm_call_scene' as const;

const contextPack = {
  ...createContextPack({
    taskGoal: 'Draft the lock-room reveal',
    agentRole: 'Writer Agent',
    riskLevel: 'High',
    sections: [{ name: 'canon', content: 'The key was hidden in the lantern.' }],
    citations: [{ sourceId: 'fact_key_lantern', quote: 'hidden in the lantern' }],
    exclusions: ['do not reveal the accomplice'],
    warnings: ['Keep the culprit ambiguous.'],
    retrievalTrace: ['chapter:12', 'entity:key']
  }),
  id: contextPackId
};

const runningRun = {
  ...createAgentRun({
    agentName: 'Writer Agent',
    taskType: 'scene_draft',
    workflowType: 'chapter_creation',
    promptVersionId: 'prompt_scene_v2',
    contextPackId
  }),
  id: agentRunId,
  status: 'Running' as const,
  createdAt: '2026-04-27T08:00:00.000Z'
};

const artifact = {
  ...createArtifactRecord({
    type: 'agent_output',
    source: 'agent_run',
    version: 1,
    hash: 'sha256:scene',
    uri: 'memory://scene-draft',
    relatedRunId: agentRunId
  }),
  id: artifactId,
  createdAt: '2026-04-27T08:01:00.000Z'
};

const llmCall = {
  ...createLlmCallRecord({
    agentRunId,
    promptVersionId: 'prompt_scene_v2',
    provider: 'fake',
    model: 'fake-model',
    schemaName: 'SceneDraft',
    usage: { inputTokens: 1000, outputTokens: 300 },
    durationMs: 450,
    estimatedCostUsd: 0.013,
    retryCount: 0,
    status: 'Succeeded'
  }),
  id: llmCallId,
  createdAt: '2026-04-27T08:02:00.000Z'
};

const workflowRun = {
  id: 'workflow_run_room',
  taskContractId: 'task_contract_room',
  steps: [
    {
      order: 1,
      name: 'build_context',
      status: 'Succeeded' as const,
      artifactIds: [contextPack.id],
      retryAttempt: 0
    },
    {
      order: 2,
      name: 'draft_scene',
      status: 'Running' as const,
      artifactIds: [artifact.id],
      retryAttempt: 1
    }
  ]
};

function createRepositories(): AgentRoomRepositories {
  return {
    agentRuns: {
      list: async () => [runningRun],
      getById: async (id) => (id === runningRun.id ? runningRun : null)
    },
    workflowRuns: {
      getByAgentRunId: async (agentRunId) => (agentRunId === runningRun.id ? workflowRun : null)
    },
    contextPacks: {
      getById: async (id) => (id === contextPack.id ? contextPack : null)
    },
    artifacts: {
      listByRunId: async (agentRunId) => (agentRunId === runningRun.id ? [artifact] : [])
    },
    llmCallLogs: {
      listByRunId: async (agentRunId) => (agentRunId === runningRun.id ? [llmCall] : [])
    },
    approvals: {
      listByRunId: async (agentRunId) =>
        agentRunId === runningRun.id
          ? [{ id: 'approval_room', runId: runningRun.id, status: 'Pending', title: 'Publish draft?' }]
          : []
    },
    durableJobs: {
      getByAgentRunId: async (agentRunId) =>
        agentRunId === runningRun.id
          ? { id: 'job_room', workflowType: 'chapter_creation', payload: {}, status: 'Running', retryCount: 0 }
          : null
    }
  };
}

async function buildTestApp(repositories: AgentRoomRepositories = createRepositories()) {
  const app = Fastify();
  registerAgentRoomRoutes(app, repositories);
  await app.ready();
  return app;
}

describe('agent room API routes', () => {
  it('lists agent room runs with list item shape', async () => {
    const app = await buildTestApp();

    const response = await app.inject({ method: 'GET', url: '/agent-room/runs' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      {
        id: runningRun.id,
        agentName: 'Writer Agent',
        taskType: 'scene_draft',
        workflowType: 'chapter_creation',
        promptVersionId: 'prompt_scene_v2',
        status: 'Running',
        jobStatus: 'Running',
        createdAt: '2026-04-27T08:00:00.000Z',
        totalCostUsd: 0.013,
        pendingApprovalCount: 1,
        allowedActions: ['cancel']
      }
    ]);
    await app.close();
  });

  it('returns run detail with graph, context, artifacts, cost, and allowed actions', async () => {
    const app = await buildTestApp();

    const response = await app.inject({ method: 'GET', url: `/agent-room/runs/${runningRun.id}` });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      run: {
        id: runningRun.id,
        agentName: 'Writer Agent',
        taskType: 'scene_draft',
        workflowType: 'chapter_creation',
        promptVersionId: 'prompt_scene_v2',
        status: 'Running',
        jobStatus: 'Running',
        createdAt: '2026-04-27T08:00:00.000Z',
        totalCostUsd: 0.013,
        pendingApprovalCount: 1,
        allowedActions: ['cancel'],
        contextPackId: contextPack.id
      },
      workflowRun,
      graph: [
        {
          id: 'workflow_run_room:1',
          order: 1,
          name: 'build_context',
          status: 'Succeeded',
          artifactIds: [contextPack.id],
          retryAttempt: 0
        },
        {
          id: 'workflow_run_room:2',
          order: 2,
          name: 'draft_scene',
          status: 'Running',
          artifactIds: [artifact.id],
          retryAttempt: 1
        }
      ],
      contextPack: {
        id: contextPack.id,
        taskGoal: 'Draft the lock-room reveal',
        agentRole: 'Writer Agent',
        riskLevel: 'High',
        sections: [{ name: 'canon', content: 'The key was hidden in the lantern.' }],
        citations: [{ sourceId: 'fact_key_lantern', quote: 'hidden in the lantern' }],
        exclusions: ['do not reveal the accomplice'],
        warnings: ['Keep the culprit ambiguous.'],
        retrievalTrace: ['chapter:12', 'entity:key'],
        createdAt: contextPack.createdAt
      },
      artifacts: [
        {
          id: artifact.id,
          type: 'agent_output',
          source: 'agent_run',
          version: 1,
          hash: 'sha256:scene',
          uri: 'memory://scene-draft',
          relatedRunId: runningRun.id,
          createdAt: '2026-04-27T08:01:00.000Z'
        }
      ],
      approvals: [{ id: 'approval_room', runId: runningRun.id, status: 'Pending', title: 'Publish draft?' }],
      costSummary: {
        totalInputTokens: 1000,
        totalOutputTokens: 300,
        totalCostUsd: 0.013,
        calls: [
          {
            id: 'llm_call_scene',
            promptVersionId: 'prompt_scene_v2',
            provider: 'fake',
            model: 'fake-model',
            schemaName: 'SceneDraft',
            inputTokens: 1000,
            outputTokens: 300,
            durationMs: 450,
            estimatedCostUsd: 0.013,
            retryCount: 0,
            status: 'Succeeded',
            createdAt: '2026-04-27T08:02:00.000Z'
          }
        ]
      }
    });
    await app.close();
  });

  it('returns 404 for missing run detail', async () => {
    const app = await buildTestApp();

    const response = await app.inject({ method: 'GET', url: '/agent-room/runs/agent_run_missing' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: 'Agent room run not found' });
    await app.close();
  });

  it('runs an allowed Agent Room action and returns the frontend action contract', async () => {
    const savedRuns: typeof runningRun[] = [];
    const savedJobs: DurableJob[] = [];
    const actionRepositories: AgentRoomActionRepositories = {
      ...createRepositories(),
      agentRuns: {
        list: async () => [runningRun],
        getById: async (id) => (id === runningRun.id ? runningRun : null),
        save: async (run) => {
          savedRuns.push(run as typeof runningRun);
        }
      },
      durableJobs: {
        getByAgentRunId: async (agentRunId) =>
          agentRunId === runningRun.id
            ? { id: 'job_room', workflowType: 'chapter_creation', payload: { agentRunId }, status: 'Running', retryCount: 0 }
            : null,
        save: async (job) => {
          savedJobs.push(job);
        }
      }
    };
    const app = await buildTestApp(actionRepositories);

    const response = await app.inject({ method: 'POST', url: `/agent-room/runs/${runningRun.id}/actions/cancel` });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      runId: runningRun.id,
      action: 'cancel',
      status: 'Cancelled',
      jobStatus: 'Cancelled'
    });
    expect(savedRuns[0]).toMatchObject({ id: runningRun.id, status: 'Cancelled' });
    expect(savedJobs[0]).toMatchObject({ id: 'job_room', status: 'Cancelled' });
    await app.close();
  });
});
