import { createId, type EntityId } from '../shared/ids';
import { systemClock } from '../shared/clock';

export type ApprovalRiskLevel = 'Medium' | 'High' | 'Blocking';
export type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';

export interface ApprovalRequest {
  id: EntityId<'approval_request'>;
  projectId: EntityId<'project'>;
  targetType: string;
  targetId: string;
  riskLevel: ApprovalRiskLevel;
  reason: string;
  proposedAction: string;
  status: ApprovalStatus;
  createdAt: string;
}

export function createApprovalRequest(input: {
  projectId: EntityId<'project'>;
  targetType: string;
  targetId: string;
  riskLevel: ApprovalRiskLevel;
  reason: string;
  proposedAction: string;
}): ApprovalRequest {
  return {
    id: createId('approval_request'),
    status: 'Pending',
    createdAt: systemClock.now(),
    ...input
  };
}
