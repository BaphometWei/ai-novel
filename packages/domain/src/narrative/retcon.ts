import { createApprovalRequest, type ApprovalRequest, type ApprovalRiskLevel } from '../memory/approvals';
import type { EntityId } from '../shared/ids';
import type { NarrativeObjectRef } from './dependencies';
import { createPendingRegressionChecks, type NarrativeRegressionCheck } from './regression';

export interface RetconAffectedObjects {
  canonFacts: string[];
  manuscriptChapters: string[];
  timelineEvents: string[];
  promises: string[];
  secrets: string[];
  worldRules: string[];
  chapters?: string[];
  arcs?: string[];
  rules?: string[];
}

export interface RetconProposalInput {
  projectId: EntityId<'project'>;
  target: NarrativeObjectRef;
  before: string;
  after: string;
  affected: RetconAffectedObjects;
}

export interface RetconProposal {
  id: string;
  projectId: EntityId<'project'>;
  target: NarrativeObjectRef;
  impactReport: {
    changedObject: NarrativeObjectRef;
    affected: RetconAffectedObjects;
  };
  diff: {
    before: string;
    after: string;
  };
  regressionChecks: NarrativeRegressionCheck[];
  approvalRisk: ApprovalRiskLevel;
  approval: ApprovalRequest;
}

export function createRetconProposal(input: RetconProposalInput): RetconProposal {
  const approvalRisk: ApprovalRiskLevel = 'High';

  return {
    id: `retcon_${crypto.randomUUID().replace(/-/g, '')}`,
    projectId: input.projectId,
    target: input.target,
    impactReport: {
      changedObject: input.target,
      affected: input.affected
    },
    diff: {
      before: input.before,
      after: input.after
    },
    regressionChecks: createPendingRegressionChecks(),
    approvalRisk,
    approval: createApprovalRequest({
      projectId: input.projectId,
      targetType: input.target.type,
      targetId: input.target.id,
      riskLevel: approvalRisk,
      reason: 'Retcon proposal requires approval before changing accepted narrative state',
      proposedAction: 'Review retcon impact and regression checks'
    })
  };
}
