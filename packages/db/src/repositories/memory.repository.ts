import type { ApprovalRequest, CanonFact } from '@ai-novel/domain';
import type { MemoryApprovalRequest, MemoryCandidateFact } from '@ai-novel/workflow';
import { eq } from 'drizzle-orm';
import type { AppDatabase } from '../connection';
import { approvalRequests, canonFacts, memoryCandidateFacts } from '../schema';

export class MemoryRepository {
  constructor(private readonly db: AppDatabase) {}

  async saveCanonFact(fact: CanonFact): Promise<void> {
    await this.db.insert(canonFacts).values({
      id: fact.id,
      projectId: fact.projectId,
      text: fact.text,
      status: fact.status,
      sourceReferencesJson: JSON.stringify(fact.sourceReferences),
      confirmationTrailJson: JSON.stringify(fact.confirmationTrail),
      ledgerJson: JSON.stringify(fact.ledger),
      createdAt: fact.createdAt,
      updatedAt: fact.updatedAt
    });
  }

  async findCanonFactById(id: string): Promise<CanonFact | null> {
    const row = await this.db.select().from(canonFacts).where(eq(canonFacts.id, id)).get();
    if (!row) return null;

    return {
      id: row.id as CanonFact['id'],
      projectId: row.projectId as CanonFact['projectId'],
      text: row.text,
      status: row.status as CanonFact['status'],
      sourceReferences: JSON.parse(row.sourceReferencesJson) as CanonFact['sourceReferences'],
      confirmationTrail: JSON.parse(row.confirmationTrailJson) as CanonFact['confirmationTrail'],
      ledger: JSON.parse(row.ledgerJson) as CanonFact['ledger'],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
  }

  async saveCandidate(candidate: MemoryCandidateFact): Promise<void> {
    await this.db
      .insert(memoryCandidateFacts)
      .values({
        id: candidate.id,
        projectId: candidate.projectId,
        manuscriptVersionId: candidate.manuscriptVersionId,
        sourceKind: candidate.sourceKind,
        text: candidate.text,
        kind: candidate.kind,
        confidence: Math.round(candidate.confidence * 1_000_000),
        riskLevel: candidate.riskLevel,
        evidence: candidate.evidence,
        status: candidate.status,
        approvalRequestId: null,
        createdAt: candidate.createdAt,
        updatedAt: candidate.createdAt
      })
      .onConflictDoUpdate({
        target: memoryCandidateFacts.id,
        set: {
          text: candidate.text,
          kind: candidate.kind,
          confidence: Math.round(candidate.confidence * 1_000_000),
          riskLevel: candidate.riskLevel,
          evidence: candidate.evidence,
          status: candidate.status,
          updatedAt: candidate.createdAt
        }
      });
  }

  async findCandidateById(id: string): Promise<(MemoryCandidateFact & { approvalRequestId?: string }) | null> {
    const row = await this.db.select().from(memoryCandidateFacts).where(eq(memoryCandidateFacts.id, id)).get();
    if (!row) return null;

    return toMemoryCandidate(row);
  }

  async linkCandidateApproval(candidateId: string, approvalRequestId: string): Promise<void> {
    await this.db
      .update(memoryCandidateFacts)
      .set({ approvalRequestId, updatedAt: new Date().toISOString() })
      .where(eq(memoryCandidateFacts.id, candidateId));
  }

  async saveApprovalRequest(request: ApprovalRequest | MemoryApprovalRequest): Promise<void> {
    const normalized = normalizeApprovalRequest(request);
    await this.db.insert(approvalRequests).values({
      id: normalized.id,
      projectId: normalized.projectId,
      targetType: normalized.targetType,
      targetId: normalized.targetId,
      riskLevel: normalized.riskLevel,
      reason: normalized.reason,
      proposedAction: normalized.proposedAction,
      status: normalized.status,
      createdAt: normalized.createdAt
    });
  }

  async findApprovalRequestById(id: string): Promise<ApprovalRequest | null> {
    const row = await this.db.select().from(approvalRequests).where(eq(approvalRequests.id, id)).get();
    if (!row) return null;

    return toApprovalRequest(row);
  }

  async listPendingApprovalRequests(): Promise<ApprovalRequest[]> {
    const rows = await this.db.select().from(approvalRequests).where(eq(approvalRequests.status, 'Pending')).all();
    return rows.map(toApprovalRequest);
  }

  async updateApprovalRequestStatus(id: string, status: ApprovalRequest['status']): Promise<ApprovalRequest | null> {
    const row = await this.db.select().from(approvalRequests).where(eq(approvalRequests.id, id)).get();
    if (!row) return null;

    await this.db.update(approvalRequests).set({ status }).where(eq(approvalRequests.id, id));

    const updated = await this.db.select().from(approvalRequests).where(eq(approvalRequests.id, id)).get();
    return updated ? toApprovalRequest(updated) : null;
  }
}

type ApprovalRequestRow = typeof approvalRequests.$inferSelect;
type MemoryCandidateRow = typeof memoryCandidateFacts.$inferSelect;

function toApprovalRequest(row: ApprovalRequestRow): ApprovalRequest {
  return {
    id: row.id as ApprovalRequest['id'],
    projectId: row.projectId as ApprovalRequest['projectId'],
    targetType: row.targetType,
    targetId: row.targetId,
    riskLevel: row.riskLevel as ApprovalRequest['riskLevel'],
    reason: row.reason,
    proposedAction: row.proposedAction,
    status: row.status as ApprovalRequest['status'],
    createdAt: row.createdAt
  };
}

function normalizeApprovalRequest(request: ApprovalRequest | MemoryApprovalRequest): ApprovalRequest {
  if ('targetType' in request) return request;

  return {
    id: request.id as ApprovalRequest['id'],
    projectId: request.projectId as ApprovalRequest['projectId'],
    targetType: 'memory_candidate_fact',
    targetId: request.candidateId,
    riskLevel: request.riskLevel === 'Low' ? 'Medium' : request.riskLevel,
    reason: `Memory candidate from manuscript version ${request.manuscriptVersionId} requires approval`,
    proposedAction: request.requestedAction,
    status: request.status,
    createdAt: request.createdAt
  };
}

function toMemoryCandidate(row: MemoryCandidateRow): MemoryCandidateFact & { approvalRequestId?: string } {
  return {
    id: row.id,
    projectId: row.projectId,
    manuscriptVersionId: row.manuscriptVersionId,
    sourceKind: row.sourceKind as MemoryCandidateFact['sourceKind'],
    text: row.text,
    kind: row.kind as MemoryCandidateFact['kind'],
    confidence: row.confidence / 1_000_000,
    riskLevel: row.riskLevel as MemoryCandidateFact['riskLevel'],
    evidence: row.evidence,
    status: row.status as MemoryCandidateFact['status'],
    createdAt: row.createdAt,
    ...(row.approvalRequestId ? { approvalRequestId: row.approvalRequestId } : {})
  };
}
