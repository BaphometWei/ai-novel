import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApiClient, type RetrievalEvaluationApiClient, type RetrievalRegressionInput } from '../api/client';
import { RetrievalEvaluationPanel } from '../components/RetrievalEvaluationPanel';

describe('RetrievalEvaluationPanel', () => {
  afterEach(() => {
    cleanup();
  });

  it('runs a retrieval regression case and shows pass/fail evidence from the API', async () => {
    const client = mockRetrievalClient();
    const runProjectRetrievalRegression = vi.mocked(client.runProjectRetrievalRegression);

    render(<RetrievalEvaluationPanel client={client} projectId="project_1" />);

    expect(screen.getByRole('heading', { name: 'Retrieval Evaluation' })).toBeInTheDocument();
    expect(screen.getByText('Running retrieval regression...')).toBeInTheDocument();

    const passed = await screen.findByLabelText('Passing retrieval case');
    expect(within(passed).getByText('Passed')).toBeInTheDocument();
    expect(within(passed).getByText('scene_archive')).toBeInTheDocument();
    expect(within(passed).getByText('source_public_1')).toBeInTheDocument();

    const failed = screen.getByLabelText('Failing retrieval case');
    expect(within(failed).getByText('Failed')).toBeInTheDocument();
    expect(within(failed).getByText('missing_required')).toBeInTheDocument();
    expect(within(failed).getByText('forbidden_included')).toBeInTheDocument();
    expect(within(failed).getByText('scene_secret')).toBeInTheDocument();
    expect(within(failed).getByText('source_restricted_7')).toBeInTheDocument();
    expect(runProjectRetrievalRegression).toHaveBeenNthCalledWith(1, 'project_1', passingRunInput);
    expect(runProjectRetrievalRegression).toHaveBeenNthCalledWith(2, 'project_1', failingRunInput);
    expect(JSON.stringify(runProjectRetrievalRegression.mock.calls)).not.toContain('included');
    expect(client.evaluateRetrievalRegression).not.toHaveBeenCalled();
  });

  it('shows retrieval evaluation errors', async () => {
    render(<RetrievalEvaluationPanel client={mockRetrievalClient({ reject: true })} projectId="project_1" />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Retrieval evaluation failed');
  });

  it('shows an empty state without calling the API when no project is selected', () => {
    const client = mockRetrievalClient();

    render(<RetrievalEvaluationPanel client={client} />);

    expect(screen.getByText('No project available.')).toBeInTheDocument();
    expect(client.runProjectRetrievalRegression).not.toHaveBeenCalled();
  });
});

describe('retrieval evaluation API client helpers', () => {
  it('runs project-backed retrieval regression payloads without included snapshots through the injected fetch implementation', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe('/api/retrieval/projects/project_demo/regression/run');
      expect(init?.method).toBe('POST');
      expect(JSON.parse(String(init?.body))).toEqual(passingRunInput);
      return jsonResponse(passingResult);
    });
    const client = createApiClient({ baseUrl: '/api', fetchImpl });

    await expect(client.runProjectRetrievalRegression('project_demo', passingRunInput)).resolves.toEqual(passingResult);
  });

  it('posts retrieval regression evaluation payloads through the injected fetch implementation', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe('/api/retrieval/regression/evaluate');
      expect(init?.method).toBe('POST');
      expect(JSON.parse(String(init?.body))).toEqual(passingInput);
      return jsonResponse(passingResult);
    });
    const client = createApiClient({ baseUrl: '/api', fetchImpl });

    await expect(client.evaluateRetrievalRegression(passingInput)).resolves.toEqual(passingResult);
  });
});

function mockRetrievalClient(options: { reject?: boolean } = {}): RetrievalEvaluationApiClient {
  return {
    runProjectRetrievalRegression: vi.fn(async (_projectId, input) => {
      if (options.reject) throw new Error('Retrieval evaluation failed');
      return input.caseId === 'case_retrieval_pass' ? passingResult : failingResult;
    }),
    evaluateRetrievalRegression: vi.fn(async (input: RetrievalRegressionInput) => {
      if (options.reject) throw new Error('Retrieval evaluation failed');
      return input.caseId === 'case_retrieval_pass' ? passingResult : failingResult;
    })
  };
}

const passingInput = {
  caseId: 'case_retrieval_pass',
  projectId: 'project_demo',
  query: 'archive door clue',
  policy: { id: 'policy_public_only', description: 'Keep restricted sources out of context.' },
  mustInclude: [{ id: 'scene_archive', text: 'Archive door clue' }],
  forbidden: [{ id: 'source_restricted_7', text: 'Restricted dossier' }],
  included: [{ id: 'scene_archive', text: 'Archive door clue' }],
  excluded: [{ id: 'source_public_1', reason: 'low_score' }]
};

const failingInput = {
  ...passingInput,
  caseId: 'case_retrieval_fail',
  mustInclude: [{ id: 'scene_secret', text: 'Secret archive scene' }],
  included: [{ id: 'source_restricted_7', text: 'Restricted dossier' }],
  excluded: [{ id: 'scene_secret', reason: 'filtered_out' }]
};

const { included: _passingIncluded, excluded: _passingExcluded, projectId: _passingProjectId, ...passingRunInput } = passingInput;
const { included: _failingIncluded, excluded: _failingExcluded, projectId: _failingProjectId, ...failingRunInput } = failingInput;

const passingResult = {
  caseId: 'case_retrieval_pass',
  projectId: 'project_demo',
  query: 'archive door clue',
  policyId: 'policy_public_only',
  passed: true,
  summary: { includedCount: 1, excludedCount: 1, failureCount: 0 },
  included: [{ id: 'scene_archive', text: 'Archive door clue' }],
  excluded: [{ id: 'source_public_1', reason: 'low_score' }],
  failures: []
};

const failingResult = {
  caseId: 'case_retrieval_fail',
  projectId: 'project_demo',
  query: 'archive door clue',
  policyId: 'policy_public_only',
  passed: false,
  summary: { includedCount: 1, excludedCount: 1, failureCount: 2 },
  included: [{ id: 'source_restricted_7', text: 'Restricted dossier' }],
  excluded: [{ id: 'scene_secret', reason: 'filtered_out' }],
  failures: [
    { kind: 'missing_required', id: 'scene_secret', message: 'Required scene was excluded.' },
    { kind: 'forbidden_included', id: 'source_restricted_7', message: 'Forbidden source was included.' }
  ]
};

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body
  } as Response;
}
