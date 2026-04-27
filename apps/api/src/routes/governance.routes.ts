import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { auditAuthorshipTransition, type ApprovalRequest, type AuthorshipAuditFinding, type EntityId } from '@ai-novel/domain';

export interface GovernanceRouteStore {
  listAuditFindingsByTarget(
    projectId: string,
    targetType: string,
    targetId: string
  ): Promise<
    {
      id: string;
      projectId: string;
      targetType: string;
      targetId: string;
      finding: AuthorshipAuditFinding;
      createdAt: string;
    }[]
  >;
  listApprovalReferencesByTarget(
    projectId: string,
    targetType: string,
    targetId: string
  ): Promise<
    {
      id: string;
      projectId: string;
      targetType: string;
      targetId: string;
      approvalRequestId: ApprovalRequest['id'] | string;
      status: ApprovalRequest['status'];
      riskLevel: ApprovalRequest['riskLevel'];
      reason: string;
      createdAt: string;
    }[]
  >;
  saveAuditFinding(record: {
    id: string;
    projectId: string;
    targetType: string;
    targetId: string;
    finding: AuthorshipAuditFinding;
    createdAt: string;
  }): Promise<void>;
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

let pendingPersistentStore: GovernanceRouteStore | undefined;

export function configurePersistentGovernanceRouteStore(store: GovernanceRouteStore): void {
  pendingPersistentStore = store;
}

const authorshipAuditSchema = z.object({
  projectId: z
    .string()
    .regex(/^project_[A-Za-z0-9_-]+$/)
    .transform((projectId) => projectId as EntityId<'project'>),
  source: z.object({
    type: z.enum(['user', 'agent_run', 'import', 'system']),
    id: z.string().min(1)
  }),
  actor: z.object({
    type: z.enum(['user', 'agent', 'system']),
    id: z.string().min(1)
  }),
  action: z.enum(['accept_draft_artifact', 'accept_manuscript_version', 'overwrite_manuscript_version', 'promote_canon_fact']),
  target: z
    .object({
      draftArtifactId: z.string().min(1).optional(),
      manuscriptVersionId: z.string().min(1).optional(),
      chapterId: z.string().min(1).optional(),
      canonFactId: z.string().min(1).optional()
    })
    .refine((target) => Object.values(target).some(Boolean)),
  transition: z.object({
    from: z.enum(['DraftArtifact', 'UserAccepted', 'ManuscriptVersion', 'CanonFact']),
    to: z.enum(['DraftArtifact', 'UserAccepted', 'ManuscriptVersion', 'CanonFact'])
  }),
  inspectedAt: z.string().min(1).optional()
});

function invalidPayload(reply: FastifyReply) {
  return reply.code(400).send({ error: 'Invalid governance payload' });
}

export function registerGovernanceRoutes(app: FastifyInstance) {
  const store = pendingPersistentStore;
  pendingPersistentStore = undefined;

  app.get<{
    Params: { projectId: string; targetType: string; targetId: string };
  }>('/governance/projects/:projectId/targets/:targetType/:targetId/audit-findings', async (request) => {
    if (!store) return [];

    return store.listAuditFindingsByTarget(
      request.params.projectId,
      request.params.targetType,
      request.params.targetId
    );
  });

  app.get<{
    Params: { projectId: string; targetType: string; targetId: string };
  }>('/governance/projects/:projectId/targets/:targetType/:targetId/approval-references', async (request) => {
    if (!store) return [];

    return store.listApprovalReferencesByTarget(
      request.params.projectId,
      request.params.targetType,
      request.params.targetId
    );
  });

  app.post('/governance/authorship-audit/inspect', async (request, reply) => {
    const parsed = authorshipAuditSchema.safeParse(request.body);
    if (!parsed.success) return invalidPayload(reply);

    const result = auditAuthorshipTransition({
      ...parsed.data,
      clock: parsed.data.inspectedAt ? { now: () => parsed.data.inspectedAt as string } : undefined
    });
    if (store) {
      await persistAuthorshipAudit(store, parsed.data.projectId, result.findings, result.approvalRequests);
    }

    return reply.send(result);
  });
}

async function persistAuthorshipAudit(
  store: GovernanceRouteStore,
  projectId: string,
  findings: AuthorshipAuditFinding[],
  approvalRequests: ApprovalRequest[]
): Promise<void> {
  for (const [index, finding] of findings.entries()) {
    const approvalRequest = approvalRequests[index];
    const targetType = approvalRequest?.targetType ?? getTargetType(finding);
    const targetId = approvalRequest?.targetId ?? getTargetId(finding);
    const id = `${projectId}:${targetType}:${targetId}:${finding.code}:${finding.createdAt}`;

    await store.saveAuditFinding({
      id,
      projectId,
      targetType,
      targetId,
      finding,
      createdAt: finding.createdAt
    });

    if (approvalRequest) {
      await store.saveApprovalReference({
        id: `${id}:approval`,
        projectId,
        targetType,
        targetId,
        approvalRequestId: approvalRequest.id,
        status: approvalRequest.status,
        riskLevel: approvalRequest.riskLevel,
        reason: approvalRequest.reason,
        createdAt: finding.createdAt
      });
    }
  }
}

function getTargetType(finding: AuthorshipAuditFinding): string {
  return finding.target.canonFactId ? 'CanonFact' : 'ManuscriptVersion';
}

function getTargetId(finding: AuthorshipAuditFinding): string {
  return finding.target.canonFactId ?? finding.target.manuscriptVersionId ?? finding.target.draftArtifactId ?? 'unknown';
}
