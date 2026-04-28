import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApiClient, type BranchRetconApiClient } from '../api/client';
import { BranchRetconPanel } from '../components/BranchRetconPanel';

describe('BranchRetconPanel', () => {
  afterEach(() => {
    cleanup();
  });

  it('projects and adopts branch scenarios, proposes retcons, and runs regression checks', async () => {
    const client = mockBranchRetconClient();
    render(<BranchRetconPanel client={client} projectId="project_1" />);

    expect(screen.getByRole('heading', { name: 'Branch & Retcon' })).toBeInTheDocument();
    expect(screen.getByText('Preparing branch and retcon checks...')).toBeInTheDocument();

    const branch = await screen.findByLabelText('Branch scenario projection');
    expect(within(branch).getByText('Moonlit Archive Branch')).toBeInTheDocument();
    expect(within(branch).getByText('canon_archive')).toBeInTheDocument();
    expect(within(branch).getByText('artifact_branch_scene')).toBeInTheDocument();
    expect(within(branch).getByText('adopted: canon_archive, canon_hidden_key')).toBeInTheDocument();

    const retcon = screen.getByLabelText('Retcon proposal');
    expect(within(retcon).getByText('Change locked door origin')).toBeInTheDocument();
    expect(within(retcon).getByText('Failed')).toBeInTheDocument();
    expect(within(retcon).getByText('timeline')).toBeInTheDocument();
    expect(within(retcon).getByText('timeline_event_2')).toBeInTheDocument();
    expect(client.runRetconRegressionChecks).toHaveBeenCalledWith({
      projectId: 'project_1',
      proposalId: 'retcon_locked_door_origin',
      checks: [{ scope: 'timeline', status: 'Failed', evidence: ['timeline_event_2'] }]
    });

    const history = await screen.findByLabelText('Persisted branch retcon history');
    expect(client.listBranchScenarios).toHaveBeenCalledWith('project_1');
    expect(client.listRetconProposalsByTarget).toHaveBeenCalledWith('project_1', 'CanonFact', 'fact_key_location');
    expect(client.listRegressionCheckRuns).toHaveBeenCalledWith('project_1', 'retcon_1');
    expect(within(history).getByText('branch_scenario_1')).toBeInTheDocument();
    expect(within(history).getByText('Open')).toBeInTheDocument();
    expect(within(history).getByText('retcon_1')).toBeInTheDocument();
    expect(within(history).getByText('Proposed')).toBeInTheDocument();
    expect(within(history).getByText('regression_run_1')).toBeInTheDocument();
    expect(within(history).getByText('Passed')).toBeInTheDocument();
  });

  it('shows branch and retcon errors', async () => {
    render(<BranchRetconPanel client={mockBranchRetconClient({ reject: true })} projectId="project_1" />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Branch projection failed');
  });

  it('shows an empty state without calling the API when no project is selected', () => {
    const client = mockBranchRetconClient();

    render(<BranchRetconPanel client={client} />);

    expect(screen.getByText('No project available.')).toBeInTheDocument();
    expect(client.projectBranchScenario).not.toHaveBeenCalled();
    expect(client.listBranchScenarios).not.toHaveBeenCalled();
  });
});

describe('branch and retcon API client helpers', () => {
  it('posts branch and retcon payloads through the injected fetch implementation', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const path = String(url);
      expect(init?.method).toBe('POST');
      if (path === '/api/branch-retcon/branches/project') {
        expect(JSON.parse(String(init?.body))).toEqual(branchProjectInput);
        return jsonResponse(branchProjectResult);
      }
      if (path === '/api/branch-retcon/branches/adopt') {
        expect(JSON.parse(String(init?.body))).toEqual(branchAdoptInput);
        return jsonResponse(branchAdoptResult);
      }
      if (path === '/api/branch-retcon/retcons/propose') {
        expect(JSON.parse(String(init?.body))).toEqual(retconInput);
        return jsonResponse(retconResult);
      }
      if (path === '/api/branch-retcon/retcons/regression-checks/run') {
        expect(JSON.parse(String(init?.body))).toEqual(regressionRunInput);
        return jsonResponse(regressionRunResult);
      }
      return jsonResponse({ error: 'Not found' }, false, 404);
    });
    const client = createApiClient({ baseUrl: '/api', fetchImpl });

    await expect(client.projectBranchScenario(branchProjectInput)).resolves.toEqual(branchProjectResult);
    await expect(client.adoptBranchScenario(branchAdoptInput)).resolves.toEqual(branchAdoptResult);
    await expect(client.createRetconProposal(retconInput)).resolves.toEqual(retconResult);
    await expect(client.runRetconRegressionChecks(regressionRunInput)).resolves.toEqual(regressionRunResult);
  });

  it('gets persisted branch scenarios, target retcon proposals, and regression runs', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(init).toBeUndefined();
      const path = String(url);
      if (path === '/api/branch-retcon/projects/project_demo/branches/scenarios') {
        return jsonResponse([branchScenarioRecord]);
      }
      if (path === '/api/branch-retcon/projects/project_demo/targets/CanonFact/fact_key_location/retcon-proposals') {
        return jsonResponse([retconProposalRecord]);
      }
      if (path === '/api/branch-retcon/projects/project_demo/retcon-proposals/retcon_1/regression-check-runs') {
        return jsonResponse([regressionRunRecord]);
      }
      return jsonResponse({ error: 'Not found' }, false, 404);
    });
    const client = createApiClient({ baseUrl: '/api', fetchImpl });

    await expect(client.listBranchScenarios('project_demo')).resolves.toEqual([branchScenarioRecord]);
    await expect(client.listRetconProposalsByTarget('project_demo', 'CanonFact', 'fact_key_location')).resolves.toEqual([
      retconProposalRecord
    ]);
    await expect(client.listRegressionCheckRuns('project_demo', 'retcon_1')).resolves.toEqual([regressionRunRecord]);
  });
});

function mockBranchRetconClient(options: { reject?: boolean } = {}): BranchRetconApiClient {
  return {
    projectBranchScenario: vi.fn(async () => {
      if (options.reject) throw new Error('Branch projection failed');
      return branchProjectResult;
    }),
    adoptBranchScenario: vi.fn(async () => {
      if (options.reject) throw new Error('Branch projection failed');
      return branchAdoptResult;
    }),
    createRetconProposal: vi.fn(async () => {
      if (options.reject) throw new Error('Branch projection failed');
      return retconResult;
    }),
    runRetconRegressionChecks: vi.fn(async () => {
      if (options.reject) throw new Error('Branch projection failed');
      return regressionRunResult;
    }),
    listBranchScenarios: vi.fn(async () => [branchScenarioRecord]),
    listRetconProposalsByTarget: vi.fn(async () => [retconProposalRecord]),
    listRegressionCheckRuns: vi.fn(async () => [regressionRunRecord])
  };
}

const canon = {
  canonFactIds: ['canon_archive'],
  artifactIds: ['artifact_draft_1']
};

const scenario = {
  projectId: 'project_demo',
  title: 'Moonlit Archive Branch',
  baseCanonFactIds: ['canon_archive'],
  artifacts: [{ id: 'artifact_branch_scene', kind: 'scene', content: 'Mira finds the hidden key.' }]
};

const branchProjectInput = { canon, scenario };

const branchProjectResult = {
  scenario: { ...scenario, id: 'branch_moonlit_archive' },
  projection: {
    baseCanonFactIds: ['canon_archive'],
    addedArtifactIds: ['artifact_branch_scene'],
    conflicts: []
  }
};

const branchAdoptInput = {
  canon,
  scenario: branchProjectResult.scenario
};

const branchAdoptResult = {
  canon: {
    canonFactIds: ['canon_archive', 'canon_hidden_key'],
    artifactIds: ['artifact_draft_1', 'artifact_branch_scene']
  }
};

const retconInput = {
  projectId: 'project_demo',
  target: { type: 'canon_fact', id: 'canon_archive' },
  before: 'The door was sealed by the city.',
  after: 'The door was sealed by Mira mother.',
  affected: {
    canonFacts: ['canon_archive'],
    manuscriptChapters: ['chapter_3'],
    timelineEvents: ['timeline_event_2'],
    promises: ['promise_locked_door'],
    secrets: [],
    worldRules: []
  }
};

const retconResult = {
  proposal: {
    id: 'retcon_locked_door_origin',
    title: 'Change locked door origin',
    target: retconInput.target,
    before: retconInput.before,
    after: retconInput.after,
    affected: retconInput.affected,
    regressionChecks: [{ scope: 'timeline', status: 'Failed', evidence: ['timeline_event_2'] }]
  },
  regression: {
    passed: false,
    checks: [{ scope: 'timeline', status: 'Failed', evidence: ['timeline_event_2'] }]
  }
};

const regressionRunInput = {
  checks: [{ scope: 'timeline', status: 'Failed', evidence: ['timeline_event_2'] }]
};

const regressionRunResult = {
  passed: false,
  checks: [{ scope: 'timeline', status: 'Failed', evidence: ['timeline_event_2'] }]
};

const branchScenarioRecord = {
  id: 'branch_scenario_1',
  projectId: 'project_demo',
  name: 'Mira keeps the key',
  baseRef: { type: 'CanonFact', id: 'fact_key_location' },
  hypothesis: 'Mira keeps the key',
  status: 'Open',
  payload: { scenario: { id: 'branch_scenario_1' } },
  createdAt: '2026-04-27T12:00:00.000Z',
  updatedAt: '2026-04-27T12:00:00.000Z'
};

const retconProposalRecord = {
  id: 'retcon_1',
  projectId: 'project_demo',
  target: { type: 'CanonFact', id: 'fact_key_location' },
  impactReport: {
    changedObject: { type: 'CanonFact', id: 'fact_key_location' },
    affected: {
      canonFacts: ['fact_key_location'],
      manuscriptChapters: [],
      timelineEvents: [],
      promises: [],
      secrets: [],
      worldRules: []
    }
  },
  diff: { before: 'Before', after: 'After' },
  regressionChecks: [],
  approvalRisk: 'High',
  approval: {
    id: 'approval_request_1',
    projectId: 'project_demo',
    targetType: 'CanonFact',
    targetId: 'fact_key_location',
    riskLevel: 'High',
    reason: 'Retcon requires approval.',
    proposedAction: 'Review retcon impact and regression checks',
    status: 'Pending',
    createdAt: '2026-04-27T12:00:00.000Z'
  },
  status: 'Proposed',
  createdAt: '2026-04-27T12:00:00.000Z',
  updatedAt: '2026-04-27T12:00:00.000Z'
};

const regressionRunRecord = {
  id: 'regression_run_1',
  projectId: 'project_demo',
  proposalId: 'retcon_1',
  status: 'Passed',
  checks: [{ scope: 'canon', status: 'Passed', evidence: ['canon verified'] }],
  createdAt: '2026-04-27T12:00:00.000Z'
};

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body
  } as Response;
}
