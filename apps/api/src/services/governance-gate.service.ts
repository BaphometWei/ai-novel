import type { ApprovalRequest } from '@ai-novel/domain';

export interface GovernanceApprovalReferenceStore {
  saveApprovalReference(reference: {
    id: string;
    projectId: string;
    targetType: string;
    targetId: string;
    approvalRequestId: ApprovalRequest['id'] | string;
    status: ApprovalRequest['status'];
    riskLevel: ApprovalRequest['riskLevel'];
    reason: string;
    createdAt: string;
  }): Promise<void>;
}

export interface GovernanceGateService {
  recordApprovalReference(input: {
    projectId: string;
    targetType: string;
    targetId: string;
    approvalRequestId: string;
    status: ApprovalRequest['status'];
    riskLevel: ApprovalRequest['riskLevel'];
    reason: string;
    sourceRunId?: string;
    createdAt: string;
  }): Promise<void>;
}

export function createGovernanceGateService(store: GovernanceApprovalReferenceStore): GovernanceGateService {
  return {
    async recordApprovalReference(input) {
      const sourceRunSuffix = input.sourceRunId ? `:${input.sourceRunId}` : '';
      await store.saveApprovalReference({
        id: `${input.projectId}:${input.targetType}:${input.targetId}:${input.approvalRequestId}${sourceRunSuffix}`,
        projectId: input.projectId,
        targetType: input.targetType,
        targetId: input.targetId,
        approvalRequestId: input.approvalRequestId,
        status: input.status,
        riskLevel: input.riskLevel,
        reason: input.reason,
        createdAt: input.createdAt
      });
    }
  };
}
