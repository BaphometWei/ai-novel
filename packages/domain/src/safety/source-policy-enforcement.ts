import type { EntityId } from '../shared/ids';
import { createApprovalRequest, type ApprovalRequest } from '../memory/approvals';
import { canUseSourceFor, type SourcePolicy } from '../knowledge/knowledge';

export interface SourcePolicyGenerationInput {
  projectId: EntityId<'project'>;
  targetId: string;
  policy: SourcePolicy;
}

export interface SourcePolicyGenerationResult {
  allowed: boolean;
  reasons: string[];
  approvalRequest?: ApprovalRequest;
}

export function enforceSourcePolicyForGeneration(input: SourcePolicyGenerationInput): SourcePolicyGenerationResult {
  const reasons: string[] = [];

  if (!canUseSourceFor(input.policy, 'generation_support')) {
    reasons.push('Source policy prohibits generation support');
  }
  if (input.policy.similarityRisk === 'High') {
    reasons.push('Source has high similarity risk');
  }

  if (reasons.length === 0) {
    return { allowed: true, reasons };
  }

  return {
    allowed: false,
    reasons,
    approvalRequest: createApprovalRequest({
      projectId: input.projectId,
      targetType: 'KnowledgeItem',
      targetId: input.targetId,
      riskLevel: reasons.some((reason) => reason.includes('prohibits')) ? 'Blocking' : 'High',
      reason: reasons.join('; '),
      proposedAction: 'Exclude source from generation context'
    })
  };
}
