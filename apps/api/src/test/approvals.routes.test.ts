import { describe, expect, it } from 'vitest';
import { buildApp } from '../app';
import type { ApprovalRouteItem, ApprovalRouteStore } from '../routes/approvals.routes';

describe('approvals API routes', () => {
  it('lists pending approval and decision items from the injected store', async () => {
    const app = buildApp({ approvals: createApprovalStore() });

    const response = await app.inject({ method: 'GET', url: '/approvals' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      items: [
        {
          id: 'approval_1',
          projectId: 'project_1',
          kind: 'approval',
          targetType: 'canon_fact',
          targetId: 'fact_1',
          title: 'Promote memory candidate',
          riskLevel: 'High',
          reason: 'Changes canon',
          proposedAction: 'promote',
          status: 'Pending',
          createdAt: '2026-04-27T10:00:00.000Z'
        },
        {
          id: 'decision_1',
          projectId: 'project_1',
          kind: 'decision',
          targetType: 'run',
          targetId: 'agent_run_1',
          title: 'Continue expensive run',
          riskLevel: 'Medium',
          reason: 'Budget threshold reached',
          proposedAction: 'continue',
          status: 'Pending',
          createdAt: '2026-04-27T10:01:00.000Z'
        }
      ]
    });
  });

  it('approves and rejects a pending approval item', async () => {
    const store = createApprovalStore();
    const app = buildApp({ approvals: store });

    const approveResponse = await app.inject({
      method: 'POST',
      url: '/approvals/approval_1/approve',
      payload: { decidedBy: 'operator', note: 'Looks good' }
    });
    const rejectResponse = await app.inject({
      method: 'POST',
      url: '/approvals/decision_1/reject',
      payload: { decidedBy: 'operator', note: 'Too risky' }
    });

    expect(approveResponse.statusCode).toBe(200);
    expect(approveResponse.json()).toMatchObject({
      id: 'approval_1',
      status: 'Approved',
      decidedBy: 'operator',
      decisionNote: 'Looks good',
      decidedAt: '2026-04-27T10:02:00.000Z'
    });
    expect(rejectResponse.statusCode).toBe(200);
    expect(rejectResponse.json()).toMatchObject({
      id: 'decision_1',
      status: 'Rejected',
      decidedBy: 'operator',
      decisionNote: 'Too risky'
    });
  });
});

function createApprovalStore(): ApprovalRouteStore {
  const items = new Map<string, ApprovalRouteItem>([
    [
      'approval_1',
      {
        id: 'approval_1',
        projectId: 'project_1',
        kind: 'approval' as const,
        targetType: 'canon_fact',
        targetId: 'fact_1',
        title: 'Promote memory candidate',
        riskLevel: 'High',
        reason: 'Changes canon',
        proposedAction: 'promote',
        status: 'Pending' as const,
        createdAt: '2026-04-27T10:00:00.000Z'
      }
    ],
    [
      'decision_1',
      {
        id: 'decision_1',
        projectId: 'project_1',
        kind: 'decision' as const,
        targetType: 'run',
        targetId: 'agent_run_1',
        title: 'Continue expensive run',
        riskLevel: 'Medium',
        reason: 'Budget threshold reached',
        proposedAction: 'continue',
        status: 'Pending' as const,
        createdAt: '2026-04-27T10:01:00.000Z'
      }
    ]
  ]);

  return {
    async listPending() {
      return [...items.values()].filter((item) => item.status === 'Pending');
    },
    async decide(id, decision) {
      const item = items.get(id);
      if (!item) return null;
      const updated = {
        ...item,
        status: decision.status,
        decidedBy: decision.decidedBy,
        decisionNote: decision.note,
        decidedAt: '2026-04-27T10:02:00.000Z'
      };
      items.set(id, updated);
      return updated;
    }
  };
}
