import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';

export type ApprovalDecisionStatus = 'Approved' | 'Rejected';
export type ApprovalItemStatus = 'Pending' | ApprovalDecisionStatus | 'Cancelled';

export interface ApprovalRouteItem {
  id: string;
  projectId: string;
  kind: 'approval' | 'decision';
  targetType: string;
  targetId: string;
  title: string;
  riskLevel: 'Medium' | 'High' | 'Blocking';
  reason: string;
  proposedAction: string;
  status: ApprovalItemStatus;
  createdAt: string;
  decidedAt?: string;
  decidedBy?: string;
  decisionNote?: string;
}

export interface ApprovalRouteStore {
  listPending(): Promise<ApprovalRouteItem[]> | ApprovalRouteItem[];
  decide(
    id: string,
    decision: { status: ApprovalDecisionStatus; decidedBy?: string; note?: string }
  ): Promise<ApprovalRouteItem | null> | ApprovalRouteItem | null;
}

export interface ApprovalPersistenceRequest {
  id: string;
  projectId: string;
  targetType: string;
  targetId: string;
  riskLevel: 'Medium' | 'High' | 'Blocking';
  reason: string;
  proposedAction: string;
  status: ApprovalItemStatus;
  createdAt: string;
}

export interface ApprovalPersistenceRepository {
  findApprovalRequestById?(id: string): Promise<ApprovalPersistenceRequest | null>;
  listPendingApprovalRequests(): Promise<ApprovalPersistenceRequest[]>;
  updateApprovalRequestStatus(id: string, status: ApprovalDecisionStatus): Promise<ApprovalPersistenceRequest | null>;
}

export interface ApprovalDecisionEffects {
  resolveMemoryCandidate?(
    approval: ApprovalPersistenceRequest,
    decision: { status: ApprovalDecisionStatus; decidedBy?: string; note?: string; decidedAt: string }
  ): Promise<void>;
  updateApprovalReferenceStatus?(approvalRequestId: string, status: ApprovalDecisionStatus): Promise<void>;
}

const decisionSchema = z.object({
  decidedBy: z.string().min(1).optional(),
  note: z.string().min(1).optional()
});

const approvalParamsSchema = z.object({
  id: z.string().min(1)
});

function invalidPayload(reply: FastifyReply) {
  return reply.code(400).send({ error: 'Invalid approval payload' });
}

export function createInMemoryApprovalStore(items: ApprovalRouteItem[] = []): ApprovalRouteStore {
  const approvals = new Map(items.map((item) => [item.id, item]));

  return {
    async listPending() {
      return [...approvals.values()].filter((item) => item.status === 'Pending');
    },
    async decide(id, decision) {
      const item = approvals.get(id);
      if (!item) return null;
      if (item.status !== 'Pending') return item;

      const updated: ApprovalRouteItem = {
        ...item,
        status: decision.status,
        decidedBy: decision.decidedBy,
        decisionNote: decision.note,
        decidedAt: new Date().toISOString()
      };
      approvals.set(id, updated);
      return updated;
    }
  };
}

export function createRepositoryApprovalStore(
  repository: ApprovalPersistenceRepository,
  options: { clock?: () => string; effects?: ApprovalDecisionEffects } = {}
): ApprovalRouteStore {
  const clock = options.clock ?? (() => new Date().toISOString());
  return {
    async listPending() {
      return (await repository.listPendingApprovalRequests()).map(toRouteItem);
    },
    async decide(id, decision) {
      const before = repository.findApprovalRequestById ? await repository.findApprovalRequestById(id) : null;
      const updated = await repository.updateApprovalRequestStatus(id, decision.status);
      if (!updated) return null;
      const decidedAt = clock();
      if ((!before || before.status === 'Pending') && updated.status === decision.status) {
        await options.effects?.resolveMemoryCandidate?.(updated, { ...decision, decidedAt });
        await options.effects?.updateApprovalReferenceStatus?.(id, decision.status);
      }

      return {
        ...toRouteItem(updated),
        decidedAt,
        decidedBy: decision.decidedBy,
        decisionNote: decision.note
      };
    }
  };
}

export function registerApprovalRoutes(app: FastifyInstance, store: ApprovalRouteStore = createInMemoryApprovalStore()) {
  app.get('/approvals', async (_request, reply) => {
    return reply.send({ items: await store.listPending() });
  });

  app.post('/approvals/:id/approve', async (request, reply) => {
    return decideApproval(request.params, request.body, reply, store, 'Approved');
  });

  app.post('/approvals/:id/reject', async (request, reply) => {
    return decideApproval(request.params, request.body, reply, store, 'Rejected');
  });
}

async function decideApproval(
  rawParams: unknown,
  rawBody: unknown,
  reply: FastifyReply,
  store: ApprovalRouteStore,
  status: ApprovalDecisionStatus
) {
  const params = approvalParamsSchema.safeParse(rawParams);
  const parsed = decisionSchema.safeParse(rawBody ?? {});
  if (!params.success || !parsed.success) return invalidPayload(reply);

  const item = await store.decide(params.data.id, { status, ...parsed.data });
  if (!item) return reply.code(404).send({ error: 'Approval not found' });
  return reply.send(item);
}

function toRouteItem(request: ApprovalPersistenceRequest): ApprovalRouteItem {
  return {
    id: request.id,
    projectId: request.projectId,
    kind: 'approval',
    targetType: request.targetType,
    targetId: request.targetId,
    title: request.proposedAction,
    riskLevel: request.riskLevel,
    reason: request.reason,
    proposedAction: request.proposedAction,
    status: request.status,
    createdAt: request.createdAt
  };
}
