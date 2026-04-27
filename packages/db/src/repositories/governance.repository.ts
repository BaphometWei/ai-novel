import type { ApprovalRequest, AuthorshipAuditFinding } from '@ai-novel/domain';
import { and, asc, eq } from 'drizzle-orm';
import type { AppDatabase } from '../connection';
import { governanceApprovalReferences, governanceAuditFindings } from '../schema';

export interface GovernanceAuditFindingRecord {
  id: string;
  projectId: string;
  targetType: string;
  targetId: string;
  finding: AuthorshipAuditFinding;
  createdAt: string;
}

export interface GovernanceApprovalReference {
  id: string;
  projectId: string;
  targetType: string;
  targetId: string;
  approvalRequestId: ApprovalRequest['id'] | string;
  status: ApprovalRequest['status'];
  riskLevel: ApprovalRequest['riskLevel'];
  reason: string;
  createdAt: string;
}

export class GovernanceRepository {
  constructor(private readonly db: AppDatabase) {}

  async saveAuditFinding(record: GovernanceAuditFindingRecord): Promise<void> {
    const row = {
      id: record.id,
      projectId: record.projectId,
      targetType: record.targetType,
      targetId: record.targetId,
      findingJson: JSON.stringify(record.finding),
      createdAt: record.createdAt
    };

    await this.db
      .insert(governanceAuditFindings)
      .values(row)
      .onConflictDoUpdate({ target: governanceAuditFindings.id, set: row });
  }

  async listAuditFindingsByTarget(
    projectId: string,
    targetType: string,
    targetId: string
  ): Promise<GovernanceAuditFindingRecord[]> {
    const rows = await this.db
      .select()
      .from(governanceAuditFindings)
      .where(
        and(
          eq(governanceAuditFindings.projectId, projectId),
          eq(governanceAuditFindings.targetType, targetType),
          eq(governanceAuditFindings.targetId, targetId)
        )
      )
      .orderBy(asc(governanceAuditFindings.createdAt), asc(governanceAuditFindings.id))
      .all();

    return rows.map((row) => ({
      id: row.id,
      projectId: row.projectId,
      targetType: row.targetType,
      targetId: row.targetId,
      finding: JSON.parse(row.findingJson) as AuthorshipAuditFinding,
      createdAt: row.createdAt
    }));
  }

  async saveApprovalReference(reference: GovernanceApprovalReference): Promise<void> {
    await this.db
      .insert(governanceApprovalReferences)
      .values(reference)
      .onConflictDoUpdate({ target: governanceApprovalReferences.id, set: reference });
  }

  async listApprovalReferencesByTarget(
    projectId: string,
    targetType: string,
    targetId: string
  ): Promise<GovernanceApprovalReference[]> {
    return this.db
      .select()
      .from(governanceApprovalReferences)
      .where(
        and(
          eq(governanceApprovalReferences.projectId, projectId),
          eq(governanceApprovalReferences.targetType, targetType),
          eq(governanceApprovalReferences.targetId, targetId)
        )
      )
      .orderBy(asc(governanceApprovalReferences.createdAt), asc(governanceApprovalReferences.id))
      .all() as Promise<GovernanceApprovalReference[]>;
  }
}
