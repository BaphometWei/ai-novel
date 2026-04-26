import type { ReviewReport, RevisionSuggestion } from '@ai-novel/domain';
import { eq } from 'drizzle-orm';
import type { AppDatabase } from '../connection';
import { reviewReports, revisionSuggestions } from '../schema';

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

  async saveRevisionSuggestion(suggestion: RevisionSuggestion): Promise<void> {
    const reportRows = await this.db.select().from(reviewReports).all();
    const findingExists = reportRows.some((row) =>
      (JSON.parse(row.findingsJson) as ReviewReport['findings']).some((finding) => finding.id === suggestion.findingId)
    );
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
