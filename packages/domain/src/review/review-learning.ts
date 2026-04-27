import type { ReviewFinding, ReviewFindingStatus, ReviewSeverity } from './review';

export type ReviewLearningEventKind = 'FalsePositive' | 'Accepted' | 'Rejected' | 'Resolved' | 'Regression';

export interface ReviewLearningEvent {
  id: string;
  findingId: string;
  kind: ReviewLearningEventKind;
  previousStatus: ReviewFindingStatus;
  nextStatus: ReviewFindingStatus;
  manuscriptVersionId: string;
  decidedBy?: string;
  reason?: string;
  rationale?: string;
  resolution?: string;
  detectedByFindingId?: string;
  occurredAt: string;
}

export interface ReviewLearningTransition {
  finding: ReviewFinding;
  event: ReviewLearningEvent;
}

export interface ReviewDecisionInput {
  decidedBy: string;
  decidedAt: string;
  reason?: string;
  rationale?: string;
}

export interface ReviewResolvedInput {
  manuscriptVersionId: string;
  resolvedBy: string;
  resolution: string;
  resolvedAt: string;
}

export interface ReviewRegressionInput {
  manuscriptVersionId: string;
  detectedByFindingId: string;
  regressedAt: string;
}

export type RecurringIssueTrend = 'Recurring' | 'Escalating';
export type RecurringIssueRisk = 'Medium' | 'High' | 'Blocking';

export interface RecurringIssueSummary {
  signature: string;
  category: string;
  occurrenceCount: number;
  chapterIds: string[];
  findingIds: string[];
  highestSeverity: ReviewSeverity;
  trend: RecurringIssueTrend;
  risk: RecurringIssueRisk;
}

export interface RecurringIssueSummaryOptions {
  minimumOccurrences?: number;
}

export function markReviewFindingFalsePositive(finding: ReviewFinding, input: Required<Pick<ReviewDecisionInput, 'decidedBy' | 'reason' | 'decidedAt'>>): ReviewLearningTransition {
  return transitionFinding(finding, 'FalsePositive', input.decidedAt, {
    decidedBy: input.decidedBy,
    reason: input.reason
  });
}

export function markReviewFindingAccepted(finding: ReviewFinding, input: Required<Pick<ReviewDecisionInput, 'decidedBy' | 'rationale' | 'decidedAt'>>): ReviewLearningTransition {
  return transitionFinding(finding, 'Accepted', input.decidedAt, {
    decidedBy: input.decidedBy,
    rationale: input.rationale
  });
}

export function markReviewFindingRejected(finding: ReviewFinding, input: Required<Pick<ReviewDecisionInput, 'decidedBy' | 'reason' | 'decidedAt'>>): ReviewLearningTransition {
  return transitionFinding(finding, 'Rejected', input.decidedAt, {
    decidedBy: input.decidedBy,
    reason: input.reason
  });
}

export function markReviewFindingResolved(finding: ReviewFinding, input: ReviewResolvedInput): ReviewLearningTransition {
  return transitionFinding(
    { ...finding, manuscriptVersionId: input.manuscriptVersionId },
    'Resolved',
    input.resolvedAt,
    {
      decidedBy: input.resolvedBy,
      resolution: input.resolution
    },
    finding.status
  );
}

export function markReviewFindingRegression(finding: ReviewFinding, input: ReviewRegressionInput): ReviewLearningTransition {
  return transitionFinding(
    { ...finding, manuscriptVersionId: input.manuscriptVersionId },
    'Regression',
    input.regressedAt,
    { detectedByFindingId: input.detectedByFindingId },
    finding.status
  );
}

export function buildRecurringIssueSummary(
  findings: ReviewFinding[],
  options: RecurringIssueSummaryOptions = {}
): RecurringIssueSummary[] {
  const minimumOccurrences = options.minimumOccurrences ?? 2;
  const grouped = new Map<string, ReviewFinding[]>();

  for (const finding of findings) {
    if (finding.status === 'FalsePositive' || finding.status === 'Rejected') {
      continue;
    }

    const signature = buildIssueSignature(finding);
    grouped.set(signature, [...(grouped.get(signature) ?? []), finding]);
  }

  return [...grouped.entries()]
    .map(([signature, issueFindings]) => toRecurringIssueSummary(signature, issueFindings))
    .filter((summary) => summary.occurrenceCount >= minimumOccurrences)
    .sort((left, right) => right.occurrenceCount - left.occurrenceCount || left.signature.localeCompare(right.signature));
}

function transitionFinding(
  finding: ReviewFinding,
  nextStatus: ReviewLearningEventKind,
  occurredAt: string,
  eventInput: Pick<ReviewLearningEvent, 'decidedBy' | 'reason' | 'rationale' | 'resolution' | 'detectedByFindingId'>,
  previousStatus: ReviewFindingStatus = finding.status
): ReviewLearningTransition {
  return {
    finding: { ...finding, status: nextStatus },
    event: {
      id: `review_learning_${crypto.randomUUID().replace(/-/g, '')}`,
      findingId: finding.id,
      kind: nextStatus,
      previousStatus,
      nextStatus,
      manuscriptVersionId: finding.manuscriptVersionId,
      occurredAt,
      ...eventInput
    }
  };
}

function buildIssueSignature(finding: ReviewFinding): string {
  return `${finding.category}:${normalizeText(finding.problem)}`;
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function toRecurringIssueSummary(signature: string, findings: ReviewFinding[]): RecurringIssueSummary {
  const chapterIds = [...new Set(findings.map((finding) => extractChapterId(finding)).filter(Boolean))].sort();
  const highestSeverity = findings.map((finding) => finding.severity).sort(compareSeverity).at(-1) ?? 'Low';

  return {
    signature,
    category: findings[0]?.category ?? 'unknown',
    occurrenceCount: findings.length,
    chapterIds,
    findingIds: findings.map((finding) => finding.id),
    highestSeverity,
    trend: findings.length >= 3 || chapterIds.length >= 3 ? 'Escalating' : 'Recurring',
    risk: classifyRecurringRisk(highestSeverity, findings.length, chapterIds.length)
  };
}

function extractChapterId(finding: ReviewFinding): string {
  const sourceId = finding.evidenceCitations[0]?.sourceId;
  return sourceId || finding.manuscriptVersionId.replace(/_v\d+$/, '');
}

function classifyRecurringRisk(severity: ReviewSeverity, occurrenceCount: number, chapterCount: number): RecurringIssueRisk {
  if (severity === 'Blocking' || (severity === 'High' && occurrenceCount >= 4)) {
    return 'Blocking';
  }

  if (severity === 'High' || occurrenceCount >= 3 || chapterCount >= 3) {
    return 'High';
  }

  return 'Medium';
}

function compareSeverity(left: ReviewSeverity, right: ReviewSeverity): number {
  return severityRank(left) - severityRank(right);
}

function severityRank(severity: ReviewSeverity): number {
  return { Low: 0, Medium: 1, High: 2, Blocking: 3 }[severity];
}
