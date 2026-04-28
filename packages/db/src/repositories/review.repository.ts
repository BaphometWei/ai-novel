import type { ReviewFindingStatus, ReviewReport, RevisionSuggestion } from '@ai-novel/domain';
import { eq } from 'drizzle-orm';
import type { AppDatabase } from '../connection';
import { reviewFindingActions, reviewReports, revisionSuggestions } from '../schema';

export type ReviewFindingActionKind = 'Accepted' | 'Rejected' | 'FalsePositive' | 'ApplyRevision' | 'ConvertToTask';

export interface ReviewFindingActionRecord {
  id: string;
  projectId: string;
  findingId: string;
  action: ReviewFindingActionKind;
  previousStatus: ReviewFindingStatus;
  nextStatus: ReviewFindingStatus;
  decidedBy?: string;
  reason?: string;
  createdTaskId?: string;
  occurredAt: string;
}

export class ReviewRepository {
  constructor(private readonly db: AppDatabase) {}

  async saveReport(report: ReviewReport): Promise<void> {
    await this.db.insert(reviewReports).values({
      id: report.id,
      projectId: report.projectId,
      manuscriptVersionId: report.manuscriptVersionId,
      profileJson: JSON.stringify(report.profile),
      findingsJson: JSON.stringify(report.findings),
      qualityScoreJson: JSON.stringify(report.qualityScore),
      openFindingCount: report.openFindingCount
    });
  }

  async findReportById(id: string): Promise<ReviewReport | null> {
    const row = await this.db.select().from(reviewReports).where(eq(reviewReports.id, id)).get();
    if (!row) return null;

    return toReviewReport(row);
  }

  async findReportContainingFinding(projectId: string, findingId: string): Promise<ReviewReport | null> {
    const rows = await this.db.select().from(reviewReports).where(eq(reviewReports.projectId, projectId)).all();
    const row = rows.find((reportRow) =>
      (JSON.parse(reportRow.findingsJson) as ReviewReport['findings']).some((finding) => finding.id === findingId)
    );
    return row ? toReviewReport(row) : null;
  }

  async recordFindingAction(input: {
    projectId: string;
    findingId: string;
    action: ReviewFindingActionKind;
    decidedBy?: string;
    reason?: string;
  }): Promise<ReviewFindingActionRecord | null> {
    const rows = await this.db.select().from(reviewReports).where(eq(reviewReports.projectId, input.projectId)).all();
    const row = rows.find((reportRow) =>
      (JSON.parse(reportRow.findingsJson) as ReviewReport['findings']).some((finding) => finding.id === input.findingId)
    );
    if (!row) return null;

    const report = toReviewReport(row);
    const finding = report.findings.find((candidate) => candidate.id === input.findingId);
    if (!finding) return null;

    const previousStatus = finding.status;
    const nextStatus = nextFindingStatus(input.action);
    const updatedFindings = report.findings.map((candidate) =>
      candidate.id === input.findingId ? { ...candidate, status: nextStatus } : candidate
    );
    const openFindingCount = updatedFindings.filter((candidate) => candidate.status === 'Open').length;

    await this.db
      .update(reviewReports)
      .set({
        findingsJson: JSON.stringify(updatedFindings),
        openFindingCount
      })
      .where(eq(reviewReports.id, report.id));

    const action: ReviewFindingActionRecord = {
      id: `review_action_${crypto.randomUUID().replace(/-/g, '')}`,
      projectId: input.projectId,
      findingId: input.findingId,
      action: input.action,
      previousStatus,
      nextStatus,
      decidedBy: input.decidedBy,
      reason: input.reason,
      createdTaskId: input.action === 'ConvertToTask' ? `task_${crypto.randomUUID().replace(/-/g, '')}` : undefined,
      occurredAt: new Date().toISOString()
    };

    await this.db.insert(reviewFindingActions).values({
      id: action.id,
      projectId: action.projectId,
      findingId: action.findingId,
      action: action.action,
      previousStatus: action.previousStatus,
      nextStatus: action.nextStatus,
      decidedBy: action.decidedBy,
      reason: action.reason,
      createdTaskId: action.createdTaskId,
      occurredAt: action.occurredAt
    });

    return action;
  }

  private async findingExists(findingId: string): Promise<boolean> {
    const reportRows = await this.db.select().from(reviewReports).all();
    return reportRows.some((row) =>
      (JSON.parse(row.findingsJson) as ReviewReport['findings']).some((finding) => finding.id === findingId)
    );
  }

  async saveRevisionSuggestion(suggestion: RevisionSuggestion): Promise<void> {
    const findingExists = await this.findingExists(suggestion.findingId);
    if (!findingExists) {
      throw new Error(`Review finding not found: ${suggestion.findingId}`);
    }

    await this.db.insert(revisionSuggestions).values({
      id: suggestion.id,
      findingId: suggestion.findingId,
      manuscriptVersionId: suggestion.manuscriptVersionId,
      title: suggestion.title,
      rationale: suggestion.rationale,
      diffJson: JSON.stringify(suggestion.diff),
      risk: suggestion.risk,
      status: suggestion.status
    });
  }

  async findRevisionSuggestionById(id: string): Promise<RevisionSuggestion | null> {
    const row = await this.db.select().from(revisionSuggestions).where(eq(revisionSuggestions.id, id)).get();
    if (!row) return null;

    return {
      id: row.id,
      findingId: row.findingId,
      manuscriptVersionId: row.manuscriptVersionId,
      title: row.title,
      rationale: row.rationale,
      diff: JSON.parse(row.diffJson) as RevisionSuggestion['diff'],
      risk: row.risk as RevisionSuggestion['risk'],
      status: row.status as RevisionSuggestion['status']
    };
  }
}

type ReviewReportRow = typeof reviewReports.$inferSelect;

function toReviewReport(row: ReviewReportRow): ReviewReport {
  return {
    id: row.id,
    projectId: row.projectId,
    manuscriptVersionId: row.manuscriptVersionId,
    profile: JSON.parse(row.profileJson) as ReviewReport['profile'],
    findings: JSON.parse(row.findingsJson) as ReviewReport['findings'],
    qualityScore: JSON.parse(row.qualityScoreJson) as ReviewReport['qualityScore'],
    openFindingCount: row.openFindingCount
  };
}

function nextFindingStatus(action: ReviewFindingActionKind): ReviewFindingStatus {
  switch (action) {
    case 'Accepted':
      return 'Accepted';
    case 'Rejected':
      return 'Rejected';
    case 'FalsePositive':
      return 'FalsePositive';
    case 'ApplyRevision':
      return 'Applied';
    case 'ConvertToTask':
      return 'Open';
  }
}
