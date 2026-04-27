import { describe, expect, it } from 'vitest';
import { buildApp } from '../app';
import { createPersistentApiRuntime } from '../runtime';
import { configurePersistentGovernanceRouteStore, type GovernanceRouteStore } from '../routes/governance.routes';

describe('governance API routes', () => {
  it('inspects authorship audit transitions and exposes high-risk findings', async () => {
    const app = buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/governance/authorship-audit/inspect',
      payload: {
        projectId: 'project_1',
        source: { type: 'agent_run', id: 'agent_run_1' },
        actor: { type: 'agent', id: 'agent_1' },
        action: 'promote_canon_fact',
        target: { canonFactId: 'canon_fact_1' },
        transition: { from: 'DraftArtifact', to: 'CanonFact' },
        inspectedAt: '2026-04-27T12:00:00.000Z'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      allowed: false,
      findings: [
        {
          code: 'HIGH_RISK_CANON_MUTATION',
          riskLevel: 'High',
          requiredApproval: true,
          createdAt: '2026-04-27T12:00:00.000Z'
        }
      ],
      approvalRequests: [
        {
          projectId: 'project_1',
          targetType: 'CanonFact',
          targetId: 'canon_fact_1',
          riskLevel: 'High'
        }
      ]
    });

    await app.close();
  });

  it('rejects invalid governance payloads', async () => {
    const app = buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/governance/authorship-audit/inspect',
      payload: { projectId: '' }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'Invalid governance payload' });

    await app.close();
  });

  it('lists persisted audit findings and approval references by target', async () => {
    const store: GovernanceRouteStore = {
      saveAuditFinding: async () => undefined,
      saveApprovalReference: async () => undefined,
      listAuditFindingsByTarget: async (projectId, targetType, targetId) => [
        {
          id: 'finding_1',
          projectId,
          targetType,
          targetId,
          finding: {
            code: 'HIGH_RISK_CANON_MUTATION',
            message: 'Agent-authored canon mutations require approval before changing canon state',
            riskLevel: 'High',
            requiredApproval: true,
            source: { type: 'agent_run', id: 'agent_run_1' },
            actor: { type: 'agent', id: 'agent_1' },
            action: 'promote_canon_fact',
            target: { canonFactId: targetId },
            createdAt: '2026-04-27T12:00:00.000Z'
          },
          createdAt: '2026-04-27T12:00:00.000Z'
        }
      ],
      listApprovalReferencesByTarget: async (projectId, targetType, targetId) => [
        {
          id: 'approval_ref_1',
          projectId,
          targetType,
          targetId,
          approvalRequestId: 'approval_request_1',
          status: 'Pending',
          riskLevel: 'High',
          reason: 'Canon fact promotion requires review.',
          createdAt: '2026-04-27T12:00:00.000Z'
        }
      ]
    };
    configurePersistentGovernanceRouteStore(store);
    const app = buildApp();

    const findingsResponse = await app.inject({
      method: 'GET',
      url: '/governance/projects/project_1/targets/CanonFact/canon_fact_1/audit-findings'
    });
    const approvalsResponse = await app.inject({
      method: 'GET',
      url: '/governance/projects/project_1/targets/CanonFact/canon_fact_1/approval-references'
    });

    expect(findingsResponse.statusCode).toBe(200);
    expect(findingsResponse.json()).toEqual([
      {
        id: 'finding_1',
        projectId: 'project_1',
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
      }
    ]);
    expect(approvalsResponse.statusCode).toBe(200);
    expect(approvalsResponse.json()).toEqual([
      {
        id: 'approval_ref_1',
        projectId: 'project_1',
        targetType: 'CanonFact',
        targetId: 'canon_fact_1',
        approvalRequestId: 'approval_request_1',
        status: 'Pending',
        riskLevel: 'High',
        reason: 'Canon fact promotion requires review.',
        createdAt: '2026-04-27T12:00:00.000Z'
      }
    ]);

    await app.close();
  });

  it('persists authorship audit findings and approval references in the persistent runtime', async () => {
    const runtime = await createPersistentApiRuntime(':memory:');
    const projectResponse = await runtime.app.inject({
      method: 'POST',
      url: '/projects',
      payload: {
        title: 'Governance Night',
        language: 'en-US',
        targetAudience: 'serial fiction readers'
      }
    });
    const projectId = projectResponse.json().id;

    const response = await runtime.app.inject({
      method: 'POST',
      url: '/governance/authorship-audit/inspect',
      payload: {
        projectId,
        source: { type: 'agent_run', id: 'agent_run_1' },
        actor: { type: 'agent', id: 'agent_1' },
        action: 'promote_canon_fact',
        target: { canonFactId: 'canon_fact_1' },
        transition: { from: 'DraftArtifact', to: 'CanonFact' },
        inspectedAt: '2026-04-27T12:00:00.000Z'
      }
    });

    expect(response.statusCode).toBe(200);
    await expect(
      runtime.stores.governance.listAuditFindingsByTarget(projectId, 'CanonFact', 'canon_fact_1')
    ).resolves.toMatchObject([
      {
        projectId,
        targetType: 'CanonFact',
        targetId: 'canon_fact_1',
        finding: { code: 'HIGH_RISK_CANON_MUTATION' }
      }
    ]);
    await expect(
      runtime.stores.governance.listApprovalReferencesByTarget(projectId, 'CanonFact', 'canon_fact_1')
    ).resolves.toMatchObject([
      {
        projectId,
        targetType: 'CanonFact',
        targetId: 'canon_fact_1',
        riskLevel: 'High'
      }
    ]);
    const findingsResponse = await runtime.app.inject({
      method: 'GET',
      url: `/governance/projects/${projectId}/targets/CanonFact/canon_fact_1/audit-findings`
    });
    const approvalsResponse = await runtime.app.inject({
      method: 'GET',
      url: `/governance/projects/${projectId}/targets/CanonFact/canon_fact_1/approval-references`
    });

    expect(findingsResponse.statusCode).toBe(200);
    expect(findingsResponse.json()).toMatchObject([
      {
        projectId,
        targetType: 'CanonFact',
        targetId: 'canon_fact_1',
        finding: { code: 'HIGH_RISK_CANON_MUTATION' }
      }
    ]);
    expect(approvalsResponse.statusCode).toBe(200);
    expect(approvalsResponse.json()).toMatchObject([
      {
        projectId,
        targetType: 'CanonFact',
        targetId: 'canon_fact_1',
        riskLevel: 'High'
      }
    ]);

    await runtime.app.close();
    runtime.database.client.close();
  });
});
