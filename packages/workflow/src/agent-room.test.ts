import { describe, expect, it } from 'vitest';
import type { AgentRun, ArtifactRecord, ContextPack, LlmCallRecord } from '@ai-novel/domain';
import type { DurableJob } from './durable-job';
import type { WorkflowRun } from './workflow-runner';
import {
  buildAgentRoomRunDetail,
  listAgentRoomRuns,
  runAgentRoomAction,
  type AgentRoomActionRepositories,
  type AgentRoomRepositories
} from './agent-room';

const agentRun: AgentRun = {
  id: 'agent_run_abc',
  agentName: 'Writer',
  taskType: 'draft_prose',
  workflowType: 'writing',
  promptVersionId: 'writer.v2.1',
  contextPackId: 'context_pack_abc',
  status: 'Failed',
  createdAt: '2026-04-27T01:00:00.000Z'
};

const workflowRun: WorkflowRun = {
  id: 'workflow_run_abc',
  taskContractId: 'task_contract_abc',
  steps: [
    { order: 1, name: 'build_context_pack', artifactIds: ['artifact_context'], status: 'Succeeded', retryAttempt: 0 },
    {
      order: 2,
      name: 'generate_draft',
      artifactIds: ['artifact_draft'],
      status: 'Failed',
      retryAttempt: 1,
      error: 'provider timeout'
    }
  ]
};

const contextPack: ContextPack = {
  id: 'context_pack_abc',
  artifactId: 'artifact_context',
  taskGoal: 'Draft the clocktower confrontation.',
  agentRole: 'Writer',
  riskLevel: 'High',
  sections: [{ name: 'canon', content: 'Mara fears bells.' }],
  citations: [{ sourceId: 'canon_1', quote: 'Mara fears bells.' }],
  exclusions: ['sample_restricted'],
  warnings: ['Excluded sample_restricted due to source policy'],
  retrievalTrace: ['query:Mara courier clocktower'],
  createdAt: '2026-04-27T00:59:00.000Z'
};

const artifacts: ArtifactRecord[] = [
  {
    id: 'artifact_context',
    type: 'context_pack',
    source: 'system',
    version: 1,
    hash: 'hash_context',
    uri: 'artifacts/context-pack.json',
    relatedRunId: 'agent_run_abc',
    createdAt: '2026-04-27T00:59:00.000Z'
  },
  {
    id: 'artifact_draft',
    type: 'agent_output',
    source: 'agent_run',
    version: 1,
    hash: 'hash_draft',
    uri: 'artifacts/draft.md',
    relatedRunId: 'agent_run_abc',
    createdAt: '2026-04-27T01:01:00.000Z'
  }
];

const llmCalls: LlmCallRecord[] = [
  {
    id: 'llm_call_1',
    agentRunId: 'agent_run_abc',
    promptVersionId: 'writer.v2.1',
    provider: 'fake',
    model: 'gpt-test',
    usage: { inputTokens: 100, outputTokens: 80 },
    durationMs: 1200,
    estimatedCostUsd: 0.012,
    retryCount: 0,
    status: 'Succeeded',
    createdAt: '2026-04-27T01:00:10.000Z'
  },
  {
    id: 'llm_call_2',
    agentRunId: 'agent_run_abc',
    promptVersionId: 'writer.v2.1',
    provider: 'fake',
    model: 'gpt-test',
    usage: { inputTokens: 40, outputTokens: 0 },
    durationMs: 900,
    estimatedCostUsd: 0.004,
    retryCount: 1,
    status: 'Failed',
    error: 'timeout',
    createdAt: '2026-04-27T01:01:10.000Z'
  }
];

const job: DurableJob = {
  id: 'job_abc',
  workflowType: 'writing',
  payload: { agentRunId: 'agent_run_abc' },
  status: 'Failed',
  retryCount: 1,
  replayOfJobId: 'job_original'
};

function repositories(): AgentRoomRepositories {
  return {
    agentRuns: {
      list: async () => [agentRun],
      getById: async (id) => (id === agentRun.id ? agentRun : null)
    },
    workflowRuns: {
      getByAgentRunId: async () => workflowRun
    },
    contextPacks: {
      getById: async () => contextPack
    },
    artifacts: {
      listByRunId: async () => artifacts
    },
    llmCallLogs: {
      listByRunId: async () => llmCalls
    },
    approvals: {
      listByRunId: async () => [
        {
          id: 'approval_abc',
          runId: 'agent_run_abc',
          title: 'Canon change needs review',
          riskLevel: 'High',
          status: 'Pending',
          createdAt: '2026-04-27T01:02:00.000Z'
        }
      ]
    },
    durableJobs: {
      getByAgentRunId: async () => job,
      findReplayLineage: async (jobId) => (jobId === job.id ? ['job_original', job.id] : [])
    }
  };
}

describe('Agent Room read model', () => {
  it('returns run list items with status, cost, pending approvals, and derived actions', async () => {
    const list = await listAgentRoomRuns(repositories());

    expect(list).toEqual([
      expect.objectContaining({
        id: 'agent_run_abc',
        agentName: 'Writer',
        taskType: 'draft_prose',
        status: 'Failed',
        totalCostUsd: 0.016,
        pendingApprovalCount: 1,
        allowedActions: ['retry', 'replay']
      })
    ]);
  });

  it('assembles run detail for graph, context inspector, artifacts, approvals, and cost summary', async () => {
    const detail = await buildAgentRoomRunDetail(repositories(), 'agent_run_abc');

    expect(detail).toMatchObject({
      run: {
        id: 'agent_run_abc',
        agentName: 'Writer',
        taskType: 'draft_prose',
        workflowType: 'writing',
        promptVersionId: 'writer.v2.1',
        status: 'Failed',
        jobStatus: 'Failed',
        allowedActions: ['retry', 'replay']
      },
      graph: [
        { id: 'workflow_run_abc:1', order: 1, name: 'build_context_pack', status: 'Succeeded' },
        { id: 'workflow_run_abc:2', order: 2, name: 'generate_draft', status: 'Failed', error: 'provider timeout' }
      ],
      contextPack: {
        id: 'context_pack_abc',
        sections: [{ name: 'canon', content: 'Mara fears bells.' }],
        citations: [{ sourceId: 'canon_1', quote: 'Mara fears bells.' }],
        exclusions: ['sample_restricted'],
        warnings: ['Excluded sample_restricted due to source policy']
      },
      artifacts: [
        { id: 'artifact_context', type: 'context_pack', uri: 'artifacts/context-pack.json' },
        { id: 'artifact_draft', type: 'agent_output', uri: 'artifacts/draft.md' }
      ],
      approvals: [{ id: 'approval_abc', status: 'Pending', riskLevel: 'High' }],
      durableJob: {
        id: 'job_abc',
        status: 'Failed',
        workflowType: 'writing',
        retryCount: 1,
        replayOfJobId: 'job_original',
        lineage: ['job_original', 'job_abc']
      },
      costSummary: {
        totalInputTokens: 140,
        totalOutputTokens: 80,
        totalCostUsd: 0.016,
        calls: [
          { id: 'llm_call_1', status: 'Succeeded', estimatedCostUsd: 0.012 },
          { id: 'llm_call_2', status: 'Failed', estimatedCostUsd: 0.004 }
        ]
      }
    });
  });

  it('returns null for a missing run instead of throwing', async () => {
    const detail = await buildAgentRoomRunDetail(repositories(), 'agent_run_missing');

    expect(detail).toBeNull();
  });
});

describe('Agent Room actions', () => {
  function actionRepositories(input: { runStatus: AgentRun['status']; jobStatus: DurableJob['status'] }) {
    const savedRuns: AgentRun[] = [];
    const savedJobs: DurableJob[] = [];
    const currentRun: AgentRun = { ...agentRun, status: input.runStatus };
    const currentJob: DurableJob = { ...job, status: input.jobStatus };
    const repositories: AgentRoomActionRepositories = {
      ...repositoriesBase(currentRun, currentJob),
      agentRuns: {
        ...repositoriesBase(currentRun, currentJob).agentRuns,
        save: async (run) => {
          savedRuns.push(run);
        }
      },
      durableJobs: {
        getByAgentRunId: async () => currentJob,
        save: async (nextJob) => {
          savedJobs.push(nextJob);
        }
      }
    };

    return { repositories, savedRuns, savedJobs };
  }

  it('cancels a running agent run and durable job', async () => {
    const { repositories, savedRuns, savedJobs } = actionRepositories({ runStatus: 'Running', jobStatus: 'Running' });

    const result = await runAgentRoomAction(repositories, 'agent_run_abc', 'cancel');

    expect(result).toMatchObject({ action: 'cancel', runId: 'agent_run_abc', runStatus: 'Cancelled', jobStatus: 'Cancelled' });
    expect(savedRuns[0]).toMatchObject({ id: 'agent_run_abc', status: 'Cancelled' });
    expect(savedJobs[0]).toMatchObject({ id: 'job_abc', status: 'Cancelled' });
  });

  it('retries a failed agent run on the existing durable job', async () => {
    const { repositories, savedRuns, savedJobs } = actionRepositories({ runStatus: 'Failed', jobStatus: 'Failed' });

    const result = await runAgentRoomAction(repositories, 'agent_run_abc', 'retry');

    expect(result).toMatchObject({ action: 'retry', runId: 'agent_run_abc', runStatus: 'Queued', jobStatus: 'Retrying' });
    expect(savedRuns[0]).toMatchObject({ id: 'agent_run_abc', status: 'Queued' });
    expect(savedJobs[0]).toMatchObject({ id: 'job_abc', status: 'Retrying', retryCount: 2 });
  });

  it('replays an agent run by creating a queued durable job linked to the original job', async () => {
    const { repositories, savedRuns, savedJobs } = actionRepositories({ runStatus: 'Succeeded', jobStatus: 'Succeeded' });

    const result = await runAgentRoomAction(repositories, 'agent_run_abc', 'replay');

    expect(result).toMatchObject({ action: 'replay', runId: 'agent_run_abc', runStatus: 'Queued', jobStatus: 'Queued' });
    expect(savedRuns[0]).toMatchObject({ id: 'agent_run_abc', status: 'Queued' });
    expect(savedJobs[0]).toMatchObject({ status: 'Queued', replayOfJobId: 'job_original' });
    expect(savedJobs[0].id).not.toBe('job_abc');
  });
});

function repositoriesBase(run: AgentRun, durableJob: DurableJob): AgentRoomRepositories {
  return {
    agentRuns: {
      list: async () => [run],
      getById: async (id) => (id === run.id ? run : null)
    },
    workflowRuns: {
      getByAgentRunId: async () => workflowRun
    },
    contextPacks: {
      getById: async () => contextPack
    },
    artifacts: {
      listByRunId: async () => artifacts
    },
    llmCallLogs: {
      listByRunId: async () => llmCalls
    },
    durableJobs: {
      getByAgentRunId: async () => durableJob
    }
  };
}
