import type { ApprovalRequest, NarrativeObjectRef, RetconProposal } from '@ai-novel/domain';
import { and, asc, eq } from 'drizzle-orm';
import type { AppDatabase } from '../connection';
import { branchScenarios, regressionCheckRuns, retconProposals } from '../schema';

export type BranchScenarioStatus = 'Open' | 'Closed' | 'Adopted' | 'Rejected';
export type RetconProposalStatus = 'Proposed' | 'Approved' | 'Rejected' | 'Adopted';
export type RegressionCheckRunStatus = 'Passed' | 'Failed' | 'Blocked';

export interface BranchScenario {
  id: string;
  projectId: string;
  name: string;
  baseRef: NarrativeObjectRef;
  hypothesis: string;
  status: BranchScenarioStatus;
  payload: unknown;
  createdAt: string;
  updatedAt: string;
}

export type PersistedRetconProposal = RetconProposal & {
  scenarioId?: string;
  status: RetconProposalStatus;
  createdAt: string;
  updatedAt: string;
};

export interface RegressionCheckRun {
  id: string;
  projectId: string;
  proposalId: string;
  status: RegressionCheckRunStatus;
  checks: unknown[];
  createdAt: string;
}

export class BranchRetconRepository {
  constructor(private readonly db: AppDatabase) {}

  async saveBranchScenario(scenario: BranchScenario): Promise<void> {
    const row = {
      id: scenario.id,
      projectId: scenario.projectId,
      name: scenario.name,
      baseRefJson: JSON.stringify(scenario.baseRef),
      hypothesis: scenario.hypothesis,
      status: scenario.status,
      payloadJson: JSON.stringify(scenario.payload),
      createdAt: scenario.createdAt,
      updatedAt: scenario.updatedAt
    };

    await this.db
      .insert(branchScenarios)
      .values(row)
      .onConflictDoUpdate({ target: branchScenarios.id, set: row });
  }

  async listBranchScenarios(projectId: string): Promise<BranchScenario[]> {
    const rows = await this.db
      .select()
      .from(branchScenarios)
      .where(eq(branchScenarios.projectId, projectId))
      .orderBy(asc(branchScenarios.createdAt), asc(branchScenarios.id))
      .all();

    return rows.map(fromBranchScenarioRow);
  }

  async saveRetconProposal(proposal: PersistedRetconProposal): Promise<void> {
    const row = {
      id: proposal.id,
      projectId: proposal.projectId,
      scenarioId: proposal.scenarioId,
      targetType: proposal.target.type,
      targetId: proposal.target.id,
      targetJson: JSON.stringify(proposal.target),
      impactReportJson: JSON.stringify(proposal.impactReport),
      diffJson: JSON.stringify(proposal.diff),
      regressionChecksJson: JSON.stringify(proposal.regressionChecks),
      approvalRisk: proposal.approvalRisk,
      approvalJson: JSON.stringify(proposal.approval),
      status: proposal.status,
      createdAt: proposal.createdAt,
      updatedAt: proposal.updatedAt
    };

    await this.db
      .insert(retconProposals)
      .values(row)
      .onConflictDoUpdate({ target: retconProposals.id, set: row });
  }

  async getRetconProposal(id: string): Promise<PersistedRetconProposal | null> {
    const row = await this.db.select().from(retconProposals).where(eq(retconProposals.id, id)).get();
    return row ? fromRetconProposalRow(row) : null;
  }

  async listRetconProposalsByTarget(
    projectId: string,
    targetType: string,
    targetId: string
  ): Promise<PersistedRetconProposal[]> {
    const rows = await this.db
      .select()
      .from(retconProposals)
      .where(
        and(
          eq(retconProposals.projectId, projectId),
          eq(retconProposals.targetType, targetType),
          eq(retconProposals.targetId, targetId)
        )
      )
      .orderBy(asc(retconProposals.createdAt), asc(retconProposals.id))
      .all();

    return rows.map(fromRetconProposalRow);
  }

  async updateRetconProposalStatus(
    id: string,
    status: RetconProposalStatus,
    updatedAt: string
  ): Promise<PersistedRetconProposal | null> {
    const existing = await this.getRetconProposal(id);
    if (!existing) return null;

    await this.db.update(retconProposals).set({ status, updatedAt }).where(eq(retconProposals.id, id));
    return this.getRetconProposal(id);
  }

  async saveRegressionCheckRun(run: RegressionCheckRun): Promise<void> {
    const row = {
      id: run.id,
      projectId: run.projectId,
      proposalId: run.proposalId,
      status: run.status,
      checksJson: JSON.stringify(run.checks),
      createdAt: run.createdAt
    };

    await this.db
      .insert(regressionCheckRuns)
      .values(row)
      .onConflictDoUpdate({ target: regressionCheckRuns.id, set: row });
  }

  async listRegressionCheckRuns(proposalId: string): Promise<RegressionCheckRun[]> {
    const rows = await this.db
      .select()
      .from(regressionCheckRuns)
      .where(eq(regressionCheckRuns.proposalId, proposalId))
      .orderBy(asc(regressionCheckRuns.createdAt), asc(regressionCheckRuns.id))
      .all();

    return rows.map((row) => ({
      id: row.id,
      projectId: row.projectId,
      proposalId: row.proposalId,
      status: row.status as RegressionCheckRunStatus,
      checks: JSON.parse(row.checksJson) as unknown[],
      createdAt: row.createdAt
    }));
  }
}

function fromBranchScenarioRow(row: typeof branchScenarios.$inferSelect): BranchScenario {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    baseRef: JSON.parse(row.baseRefJson) as NarrativeObjectRef,
    hypothesis: row.hypothesis,
    status: row.status as BranchScenarioStatus,
    payload: JSON.parse(row.payloadJson) as unknown,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function fromRetconProposalRow(row: typeof retconProposals.$inferSelect): PersistedRetconProposal {
  return {
    id: row.id,
    projectId: row.projectId as RetconProposal['projectId'],
    scenarioId: row.scenarioId ?? undefined,
    target: JSON.parse(row.targetJson) as NarrativeObjectRef,
    impactReport: JSON.parse(row.impactReportJson) as RetconProposal['impactReport'],
    diff: JSON.parse(row.diffJson) as RetconProposal['diff'],
    regressionChecks: JSON.parse(row.regressionChecksJson) as RetconProposal['regressionChecks'],
    approvalRisk: row.approvalRisk as RetconProposal['approvalRisk'],
    approval: JSON.parse(row.approvalJson) as ApprovalRequest,
    status: row.status as RetconProposalStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}
