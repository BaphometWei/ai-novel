import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApiClient, type GovernanceApiClient } from '../api/client';
import { GovernanceAuditPanel } from '../components/GovernanceAuditPanel';

describe('GovernanceAuditPanel', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows allowed and blocked authorship audit decisions plus approval needs', async () => {
    const client = mockGovernanceClient();
    render(<GovernanceAuditPanel client={client} projectId="project_1" />);

    expect(screen.getByRole('heading', { name: 'Governance Audit' })).toBeInTheDocument();
    expect(screen.getByText('Loading governance audit...')).toBeInTheDocument();

    const allowed = await screen.findByLabelText('Allowed authorship transition');
    expect(await within(allowed).findByText('Allowed')).toBeInTheDocument();
    expect(within(allowed).getByText('accept_manuscript_version')).toBeInTheDocument();
    expect(within(allowed).getByText('Approval required')).toBeInTheDocument();

    const blocked = screen.getByLabelText('Blocked authorship transition');
    expect(await within(blocked).findByText('Blocked')).toBeInTheDocument();
    expect(within(blocked).getByText('overwrite_manuscript_version')).toBeInTheDocument();
    expect(within(blocked).getByText('Missing human approval')).toBeInTheDocument();

    const history = await screen.findByLabelText('Persisted governance history');
    expect(client.listAuditFindingsByTarget).toHaveBeenCalledWith('project_1', 'CanonFact', 'canon_fact_1');
    expect(client.listApprovalReferencesByTarget).toHaveBeenCalledWith('project_1', 'CanonFact', 'canon_fact_1');
    expect(within(history).getByText('HIGH_RISK_CANON_MUTATION')).toBeInTheDocument();
    expect(within(history).getAllByText('High')).toHaveLength(2);
    expect(within(history).getByText('Pending')).toBeInTheDocument();
    expect(within(history).getByText('approval_request_1')).toBeInTheDocument();
  });

  it('shows audit errors', async () => {
    render(<GovernanceAuditPanel client={mockGovernanceClient({ reject: true })} projectId="project_1" />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Authorship audit failed');
  });

  it('shows an empty state without calling the API when no project is selected', () => {
    const client = mockGovernanceClient();

    render(<GovernanceAuditPanel client={client} />);

    expect(screen.getByText('No project available.')).toBeInTheDocument();
    expect(client.inspectAuthorshipAudit).not.toHaveBeenCalled();
    expect(client.listAuditFindingsByTarget).not.toHaveBeenCalled();
    expect(client.listApprovalReferencesByTarget).not.toHaveBeenCalled();
  });
});

describe('governance API client helpers', () => {
  it('posts authorship audit inspect payloads through the injected fetch implementation', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe('/api/governance/authorship-audit/inspect');
      expect(init?.method).toBe('POST');
      expect(JSON.parse(String(init?.body))).toEqual(allowedInput);
      return jsonResponse(allowedResult);
    });
    const client = createApiClient({ baseUrl: '/api', fetchImpl });

    await expect(client.inspectAuthorshipAudit(allowedInput)).resolves.toEqual(allowedResult);
  });

  it('gets persisted audit findings and approval references by project target', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(init).toBeUndefined();
      const path = String(url);
      if (path === '/api/governance/projects/project_demo/targets/CanonFact/canon_fact_1/audit-findings') {
        return jsonResponse([auditFindingRecord]);
      }
      if (path === '/api/governance/projects/project_demo/targets/CanonFact/canon_fact_1/approval-references') {
        return jsonResponse([approvalReference]);
      }
      return jsonResponse({ error: 'Not found' }, false, 404);
    });
    const client = createApiClient({ baseUrl: '/api', fetchImpl });

    await expect(client.listAuditFindingsByTarget('project_demo', 'CanonFact', 'canon_fact_1')).resolves.toEqual([
      auditFindingRecord
    ]);
    await expect(client.listApprovalReferencesByTarget('project_demo', 'CanonFact', 'canon_fact_1')).resolves.toEqual([
      approvalReference
    ]);
  });
});

function mockGovernanceClient(options: { reject?: boolean } = {}): GovernanceApiClient {
  return {
    inspectAuthorshipAudit: vi.fn(async (input) => {
      if (options.reject) throw new Error('Authorship audit failed');
      return input.action === 'overwrite_manuscript_version' ? blockedResult : allowedResult;
    }),
    listAuditFindingsByTarget: vi.fn(async () => [auditFindingRecord]),
    listApprovalReferencesByTarget: vi.fn(async () => [approvalReference])
  };
}

const allowedInput = {
  projectId: 'project_demo',
  source: { type: 'agent_run', id: 'run_1' },
  actor: { type: 'user', id: 'user_editor' },
  action: 'accept_manuscript_version',
  target: { manuscriptVersionId: 'manuscript_v2' },
  transition: { from: 'DraftArtifact', to: 'ManuscriptVersion' },
  inspectedAt: '2026-04-27T12:00:00.000Z'
};

const allowedResult = {
  allowed: true,
  action: 'accept_manuscript_version',
  status: 'Allowed',
  approvalRequired: true,
  approvalReasons: ['Human acceptance required'],
  blockers: []
};

const blockedResult = {
  allowed: false,
  action: 'overwrite_manuscript_version',
  status: 'Blocked',
  approvalRequired: true,
  approvalReasons: ['Approval required for overwrite'],
  blockers: ['Missing human approval']
};

const auditFindingRecord = {
  id: 'finding_1',
  projectId: 'project_demo',
  targetType: 'CanonFact',
  targetId: 'canon_fact_1',
  finding: {
    code: 'HIGH_RISK_CANON_MUTATION',
    message: 'Agent-authored canon mutations require approval before changing canon state',
    riskLevel: 'High',
    requiredApproval: true,
    source: { type: 'agent_run', id: 'agent_run_1' },
    actor: { type: 'agent', id: 'agent_1' },
    action: 'promote_canon_fact',
    target: { canonFactId: 'canon_fact_1' },
    createdAt: '2026-04-27T12:00:00.000Z'
  },
  createdAt: '2026-04-27T12:00:00.000Z'
};

const approvalReference = {
  id: 'approval_ref_1',
  projectId: 'project_demo',
  targetType: 'CanonFact',
  targetId: 'canon_fact_1',
  approvalRequestId: 'approval_request_1',
  status: 'Pending',
  riskLevel: 'High',
  reason: 'Canon fact promotion requires review.',
  createdAt: '2026-04-27T12:00:00.000Z'
};

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body
  } as Response;
}
