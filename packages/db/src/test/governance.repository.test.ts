import { auditAuthorshipTransition, createProject } from '@ai-novel/domain';
import { describe, expect, it } from 'vitest';
import { createDatabase } from '../connection';
import { migrateDatabase } from '../migrate';
import { GovernanceRepository, type GovernanceApprovalReference } from '../repositories/governance.repository';
import { ProjectRepository } from '../repositories/project.repository';

describe('GovernanceRepository', () => {
  it('persists audit findings and approval references by project target', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const project = createProject({
      title: 'Long Night',
      language: 'zh-CN',
      targetAudience: 'Chinese web-novel readers'
    });
    await new ProjectRepository(database.db).save(project);
    const repository = new GovernanceRepository(database.db);
    const audit = auditAuthorshipTransition({
      projectId: project.id,
      source: { type: 'agent_run', id: 'agent_run_1' },
      actor: { type: 'agent', id: 'agent_writer' },
      action: 'accept_manuscript_version',
      target: { manuscriptVersionId: 'chapter_version_7', chapterId: 'chapter_7' },
      transition: { from: 'DraftArtifact', to: 'ManuscriptVersion' },
      clock: { now: () => '2026-04-27T12:00:00.000Z' }
    });
    const approvalReference: GovernanceApprovalReference = {
      id: 'governance_approval_ref_1',
      projectId: project.id,
      targetType: audit.approvalRequests[0].targetType,
      targetId: audit.approvalRequests[0].targetId,
      approvalRequestId: audit.approvalRequests[0].id,
      status: audit.approvalRequests[0].status,
      riskLevel: audit.approvalRequests[0].riskLevel,
      reason: audit.approvalRequests[0].reason,
      createdAt: audit.approvalRequests[0].createdAt
    };

    await repository.saveAuditFinding({
      id: 'governance_finding_1',
      projectId: project.id,
      targetType: 'ManuscriptVersion',
      targetId: 'chapter_version_7',
      finding: audit.findings[0],
      createdAt: audit.findings[0].createdAt
    });
    await repository.saveApprovalReference(approvalReference);

    await expect(repository.listAuditFindingsByTarget(project.id, 'ManuscriptVersion', 'chapter_version_7')).resolves.toMatchObject([
      {
        id: 'governance_finding_1',
        projectId: project.id,
        targetId: 'chapter_version_7',
        finding: {
          code: 'DIRECT_TO_ACCEPTED_AGENT_PROSE',
          source: { type: 'agent_run', id: 'agent_run_1' },
          target: { manuscriptVersionId: 'chapter_version_7', chapterId: 'chapter_7' }
        }
      }
    ]);
    await expect(repository.listApprovalReferencesByTarget(project.id, 'ManuscriptVersion', 'chapter_version_7')).resolves.toEqual([
      approvalReference
    ]);
    database.client.close();
  });

  it('lists approval references by source run without including other runs on the same target', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const project = createProject({
      title: 'Shared Target',
      language: 'zh-CN',
      targetAudience: 'Chinese web-novel readers'
    });
    await new ProjectRepository(database.db).save(project);
    const repository = new GovernanceRepository(database.db);
    const firstAudit = auditAuthorshipTransition({
      projectId: project.id,
      source: { type: 'agent_run', id: 'agent_run_first' },
      actor: { type: 'agent', id: 'agent_writer' },
      action: 'promote_canon_fact',
      target: { canonFactId: 'canon_fact_shared' },
      transition: { from: 'DraftArtifact', to: 'CanonFact' },
      clock: { now: () => '2026-04-27T12:00:00.000Z' }
    });
    const secondAudit = auditAuthorshipTransition({
      projectId: project.id,
      source: { type: 'agent_run', id: 'agent_run_second' },
      actor: { type: 'agent', id: 'agent_writer' },
      action: 'promote_canon_fact',
      target: { canonFactId: 'canon_fact_shared' },
      transition: { from: 'DraftArtifact', to: 'CanonFact' },
      clock: { now: () => '2026-04-27T12:01:00.000Z' }
    });
    const firstReference = approvalReferenceFromAudit(project.id, 'governance_finding_first', firstAudit);
    const secondReference = approvalReferenceFromAudit(project.id, 'governance_finding_second', secondAudit);

    await repository.saveAuditFinding({
      id: 'governance_finding_first',
      projectId: project.id,
      targetType: 'CanonFact',
      targetId: 'canon_fact_shared',
      finding: firstAudit.findings[0],
      createdAt: firstAudit.findings[0].createdAt
    });
    await repository.saveAuditFinding({
      id: 'governance_finding_second',
      projectId: project.id,
      targetType: 'CanonFact',
      targetId: 'canon_fact_shared',
      finding: secondAudit.findings[0],
      createdAt: secondAudit.findings[0].createdAt
    });
    await repository.saveApprovalReference(firstReference);
    await repository.saveApprovalReference(secondReference);

    await expect(repository.listApprovalReferencesBySourceRunId('agent_run_first')).resolves.toEqual([firstReference]);
    database.client.close();
  });
});

function approvalReferenceFromAudit(
  projectId: string,
  findingId: string,
  audit: ReturnType<typeof auditAuthorshipTransition>
): GovernanceApprovalReference {
  const approvalRequest = audit.approvalRequests[0];
  return {
    id: `${findingId}:approval`,
    projectId,
    targetType: approvalRequest.targetType,
    targetId: approvalRequest.targetId,
    approvalRequestId: approvalRequest.id,
    status: approvalRequest.status,
    riskLevel: approvalRequest.riskLevel,
    reason: approvalRequest.reason,
    createdAt: audit.findings[0].createdAt
  };
}
