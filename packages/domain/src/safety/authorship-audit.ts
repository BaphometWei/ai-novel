import { createApprovalRequest, type ApprovalRequest, type ApprovalRiskLevel } from '../memory/approvals';
import { systemClock, type Clock } from '../shared/clock';
import type { EntityId } from '../shared/ids';

export type AuthorshipAuditSourceType = 'user' | 'agent_run' | 'import' | 'system';
export type AuthorshipAuditActorType = 'user' | 'agent' | 'system';
export type AuthorshipAuditAction =
  | 'accept_draft_artifact'
  | 'accept_manuscript_version'
  | 'overwrite_manuscript_version'
  | 'promote_canon_fact';
export type AuthorshipAuditTransitionState = 'DraftArtifact' | 'UserAccepted' | 'ManuscriptVersion' | 'CanonFact';
export type AuthorshipAuditFindingCode =
  | 'DIRECT_TO_ACCEPTED_AGENT_PROSE'
  | 'SILENT_MANUSCRIPT_OVERWRITE'
  | 'HIGH_RISK_CANON_MUTATION';

export interface AuthorshipAuditSource {
  type: AuthorshipAuditSourceType;
  id: string;
}

export interface AuthorshipAuditActor {
  type: AuthorshipAuditActorType;
  id: string;
}

export interface AuthorshipAuditTarget {
  draftArtifactId?: string;
  manuscriptVersionId?: string;
  chapterId?: string;
  canonFactId?: string;
}

export interface AuthorshipAuditTransition {
  from: AuthorshipAuditTransitionState;
  to: AuthorshipAuditTransitionState;
}

export interface AuthorshipAuditFinding {
  code: AuthorshipAuditFindingCode;
  message: string;
  riskLevel: ApprovalRiskLevel;
  requiredApproval: boolean;
  source: AuthorshipAuditSource;
  actor: AuthorshipAuditActor;
  action: AuthorshipAuditAction;
  target: AuthorshipAuditTarget;
  createdAt: string;
}

export interface AuthorshipAuditInput {
  projectId: EntityId<'project'>;
  source: AuthorshipAuditSource;
  actor: AuthorshipAuditActor;
  action: AuthorshipAuditAction;
  target: AuthorshipAuditTarget;
  transition: AuthorshipAuditTransition;
  clock?: Clock;
}

export interface AuthorshipAuditResult {
  allowed: boolean;
  findings: AuthorshipAuditFinding[];
  approvalRequests: ApprovalRequest[];
}

const DIRECT_TO_ACCEPTED_MESSAGE =
  'Agent-authored prose must be user accepted before becoming an accepted manuscript version';
const SILENT_OVERWRITE_MESSAGE = 'Accepted manuscript prose cannot be silently overwritten';
const HIGH_RISK_CANON_MUTATION_MESSAGE = 'Agent-authored canon mutations require approval before changing canon state';

export function auditAuthorshipTransition(input: AuthorshipAuditInput): AuthorshipAuditResult {
  const findings: AuthorshipAuditFinding[] = [];
  const clock = input.clock ?? systemClock;

  if (
    input.source.type === 'agent_run' &&
    input.action === 'accept_manuscript_version' &&
    input.transition.to === 'ManuscriptVersion' &&
    input.transition.from !== 'UserAccepted'
  ) {
    findings.push(
      createFinding(input, clock, {
      code: 'DIRECT_TO_ACCEPTED_AGENT_PROSE',
        message: DIRECT_TO_ACCEPTED_MESSAGE
      })
    );
  }

  if (input.action === 'overwrite_manuscript_version' && input.transition.to === 'ManuscriptVersion') {
    findings.push(
      createFinding(input, clock, {
        code: 'SILENT_MANUSCRIPT_OVERWRITE',
        message: SILENT_OVERWRITE_MESSAGE
      })
    );
  }

  if (input.actor.type !== 'user' && input.action === 'promote_canon_fact') {
    findings.push(
      createFinding(input, clock, {
        code: 'HIGH_RISK_CANON_MUTATION',
        message: HIGH_RISK_CANON_MUTATION_MESSAGE
      })
    );
  }

  return {
    allowed: findings.length === 0,
    findings,
    approvalRequests: findings.map((finding) =>
      createApprovalRequest({
        projectId: input.projectId,
        targetType: getApprovalTargetType(input.target),
        targetId: getApprovalTargetId(input.target),
        riskLevel: finding.riskLevel,
        reason: finding.message,
        proposedAction: 'Review authorship audit violation before mutating canon or manuscript state'
      })
    )
  };
}

function createFinding(
  input: AuthorshipAuditInput,
  clock: Clock,
  finding: { code: AuthorshipAuditFindingCode; message: string }
): AuthorshipAuditFinding {
  return {
    code: finding.code,
    message: finding.message,
    riskLevel: 'High',
    requiredApproval: true,
    source: input.source,
    actor: input.actor,
    action: input.action,
    target: input.target,
    createdAt: clock.now()
  };
}

function getApprovalTargetType(target: AuthorshipAuditTarget): string {
  if (target.canonFactId) {
    return 'CanonFact';
  }
  return 'ManuscriptVersion';
}

function getApprovalTargetId(target: AuthorshipAuditTarget): string {
  return target.canonFactId ?? target.manuscriptVersionId ?? target.draftArtifactId ?? 'unknown';
}
