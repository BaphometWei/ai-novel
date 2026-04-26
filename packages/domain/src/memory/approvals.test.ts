import { describe, expect, it } from 'vitest';
import { createApprovalRequest } from './approvals';

describe('createApprovalRequest', () => {
  it('captures high-risk canon changes for the decision queue', () => {
    const request = createApprovalRequest({
      projectId: 'project_abc',
      targetType: 'CanonFact',
      targetId: 'canon_fact_abc',
      riskLevel: 'High',
      reason: 'Changes protagonist backstory',
      proposedAction: 'Promote draft memory to canon'
    });

    expect(request.status).toBe('Pending');
    expect(request.riskLevel).toBe('High');
    expect(request.reason).toBe('Changes protagonist backstory');
  });
});
