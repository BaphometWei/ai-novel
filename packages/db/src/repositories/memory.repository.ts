import type { ApprovalRequest, CanonFact } from '@ai-novel/domain';
import { eq } from 'drizzle-orm';
import type { AppDatabase } from '../connection';
import { approvalRequests, canonFacts } from '../schema';

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

  async saveApprovalRequest(request: ApprovalRequest): Promise<void> {
    await this.db.insert(approvalRequests).values({
      id: request.id,
      projectId: request.projectId,
      targetType: request.targetType,
      targetId: request.targetId,
      riskLevel: request.riskLevel,
      reason: request.reason,
      proposedAction: request.proposedAction,
      status: request.status,
      createdAt: request.createdAt
    });
  }

  async findApprovalRequestById(id: string): Promise<ApprovalRequest | null> {
    const row = await this.db.select().from(approvalRequests).where(eq(approvalRequests.id, id)).get();
    if (!row) return null;

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
}
