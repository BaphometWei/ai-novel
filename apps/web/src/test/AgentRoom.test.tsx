import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApiClient, type AgentRoomApiClient, type AgentRoomRunDetail } from '../api/client';
import { AgentRoom } from '../components/AgentRoom';

describe('AgentRoom', () => {
  afterEach(() => {
    cleanup();
  });

  it('loads runs, selects the first run, and renders graph, context, artifacts, approvals, cost, and actions', async () => {
    render(<AgentRoom client={mockAgentRoomClient()} />);

    expect(screen.getByText('Loading agent runs...')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Writer Agent' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Writer Agent scene_draft Running/i })).toHaveAttribute(
      'aria-selected',
      'true'
    );

    expect(screen.getByText('build_context')).toBeInTheDocument();
    expect(screen.getByText('draft_scene')).toBeInTheDocument();
    expect(screen.getByText('Draft the lock-room reveal')).toBeInTheDocument();
    expect(screen.getByText('hidden in the lantern')).toBeInTheDocument();
    expect(screen.getByText('Keep the culprit ambiguous.')).toBeInTheDocument();
    expect(screen.getByText('do not reveal the accomplice')).toBeInTheDocument();
    expect(screen.getByText('chapter:12')).toBeInTheDocument();
    expect(screen.getByText('memory://scene-draft')).toBeInTheDocument();
    expect(screen.getByText('Publish draft?')).toBeInTheDocument();
    expect(screen.getByText('$0.013')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel run' })).toBeInTheDocument();
  });

  it('loads the selected run detail when a different run is chosen', async () => {
    const client = mockAgentRoomClient({ includeSecondRun: true });

    render(<AgentRoom client={client} />);

    await screen.findByRole('heading', { name: 'Writer Agent' });
    fireEvent.click(screen.getByRole('button', { name: /Editor Agent revision_review Failed/i }));

    expect(await screen.findByRole('heading', { name: 'Editor Agent' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry run' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Replay run' })).toBeInTheDocument();
    expect(screen.getByText('Review continuity before merge')).toBeInTheDocument();
  });

  it('runs allowed actions and reports success or failure', async () => {
    const client = mockAgentRoomClient({ rejectAction: 'retry' });
    const runAction = vi.spyOn(client, 'runAgentRoomAction');

    render(<AgentRoom client={client} />);

    await screen.findByRole('heading', { name: 'Writer Agent' });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel run' }));

    expect(await screen.findByText('Action cancel completed.')).toBeInTheDocument();
    expect(runAction).toHaveBeenCalledWith('agent_run_room', 'cancel');

    fireEvent.click(screen.getByRole('button', { name: /Editor Agent revision_review Failed/i }));
    await screen.findByRole('heading', { name: 'Editor Agent' });
    fireEvent.click(screen.getByRole('button', { name: 'Retry run' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Retry failed');
    expect(runAction).toHaveBeenCalledWith('agent_run_editor', 'retry');
  });

  it('shows an empty state when there are no agent runs', async () => {
    render(<AgentRoom client={mockAgentRoomClient({ empty: true })} />);

    expect(await screen.findByText('No agent runs yet.')).toBeInTheDocument();
  });
});

describe('agent room API client helpers', () => {
  afterEach(() => {
    cleanup();
  });

  it('loads run list and detail through the injected fetch implementation', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const path = String(url);
      if (path === '/api/agent-room/runs') return jsonResponse({ runs: [agentRunDetail.run] });
      if (path === '/api/agent-room/runs/agent_run_room') return jsonResponse(agentRunDetail);
      if (path === '/api/agent-room/runs/agent_run_room/actions/cancel' && init?.method === 'POST') {
        return jsonResponse({ runId: 'agent_run_room', action: 'cancel', status: 'accepted' });
      }
      return jsonResponse({ error: 'Not found' }, false, 404);
    });
    const client = createApiClient({ baseUrl: '/api', fetchImpl });

    const runs = await client.listAgentRoomRuns();
    const detail = await client.getAgentRoomRun('agent_run_room');
    const action = await client.runAgentRoomAction('agent_run_room', 'cancel');

    expect(runs).toEqual([expect.objectContaining({ id: 'agent_run_room', allowedActions: ['cancel'] })]);
    expect(detail.contextPack?.citations).toEqual([{ sourceId: 'fact_key_lantern', quote: 'hidden in the lantern' }]);
    expect(detail.costSummary.totalCostUsd).toBe(0.013);
    expect(action).toEqual({ runId: 'agent_run_room', action: 'cancel', status: 'accepted' });
    expect(fetchImpl).toHaveBeenCalledWith('/api/agent-room/runs');
    expect(fetchImpl).toHaveBeenCalledWith('/api/agent-room/runs/agent_run_room');
    expect(fetchImpl).toHaveBeenCalledWith('/api/agent-room/runs/agent_run_room/actions/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
  });
});

function mockAgentRoomClient(
  options: { empty?: boolean; includeSecondRun?: boolean; rejectAction?: string } = {}
): AgentRoomApiClient {
  const details: Record<string, AgentRoomRunDetail> = {
    agent_run_room: agentRunDetail,
    agent_run_editor: editorRunDetail
  };

  return {
    listAgentRoomRuns: async () => {
      if (options.empty) return [];
      return options.includeSecondRun || options.rejectAction ? [agentRunDetail.run, editorRunDetail.run] : [agentRunDetail.run];
    },
    getAgentRoomRun: async (runId) => details[runId] ?? agentRunDetail,
    runAgentRoomAction: async (runId, action) => {
      if (options.rejectAction === action) throw new Error('Retry failed');
      return { runId, action, status: 'accepted' };
    }
  };
}

const agentRunDetail: AgentRoomRunDetail = {
  run: {
    id: 'agent_run_room',
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
    contextPackId: 'context_pack_room'
  },
  workflowRun: {
    id: 'workflow_run_room',
    taskContractId: 'task_contract_room',
    steps: []
  },
  graph: [
    {
      id: 'workflow_run_room:1',
      order: 1,
      name: 'build_context',
      status: 'Succeeded',
      artifactIds: ['context_pack_room'],
      retryAttempt: 0
    },
    {
      id: 'workflow_run_room:2',
      order: 2,
      name: 'draft_scene',
      status: 'Running',
      artifactIds: ['artifact_scene'],
      retryAttempt: 1
    }
  ],
  contextPack: {
    id: 'context_pack_room',
    taskGoal: 'Draft the lock-room reveal',
    agentRole: 'Writer Agent',
    riskLevel: 'High',
    sections: [{ name: 'canon', content: 'The key was hidden in the lantern.' }],
    citations: [{ sourceId: 'fact_key_lantern', quote: 'hidden in the lantern' }],
    exclusions: ['do not reveal the accomplice'],
    warnings: ['Keep the culprit ambiguous.'],
    retrievalTrace: ['chapter:12', 'entity:key'],
    createdAt: '2026-04-27T08:00:00.000Z'
  },
  artifacts: [
    {
      id: 'artifact_scene',
      type: 'agent_output',
      source: 'agent_run',
      version: 1,
      hash: 'sha256:scene',
      uri: 'memory://scene-draft',
      relatedRunId: 'agent_run_room',
      createdAt: '2026-04-27T08:01:00.000Z'
    }
  ],
  approvals: [{ id: 'approval_room', runId: 'agent_run_room', status: 'Pending', title: 'Publish draft?' }],
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
};

const editorRunDetail: AgentRoomRunDetail = {
  ...agentRunDetail,
  run: {
    ...agentRunDetail.run,
    id: 'agent_run_editor',
    agentName: 'Editor Agent',
    taskType: 'revision_review',
    status: 'Failed',
    jobStatus: 'Failed',
    allowedActions: ['retry', 'replay'],
    contextPackId: 'context_pack_editor'
  },
  contextPack: {
    ...agentRunDetail.contextPack!,
    id: 'context_pack_editor',
    taskGoal: 'Review continuity before merge',
    agentRole: 'Editor Agent'
  },
  approvals: []
};

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body
  } as Response;
}
