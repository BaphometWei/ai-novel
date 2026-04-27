import {
  buildRecurringIssueSummary,
  markReviewFindingRegression,
  type RecurringIssueSummary,
  type ReviewFinding,
  type ReviewLearningTransition
} from '@ai-novel/domain';

export interface RevisionRecheckInput {
  previousFindings: ReviewFinding[];
  currentFindings: ReviewFinding[];
  checkedAt: string;
}

export interface RevisionRecheckResult {
  regressions: ReviewLearningTransition[];
  recurringIssues: RecurringIssueSummary[];
}

export function recheckRevisionReview(input: RevisionRecheckInput): RevisionRecheckResult {
  const regressions = input.previousFindings
    .filter((finding) => finding.status === 'Resolved')
    .map((finding) => {
      const currentFinding = findRecurringCurrentFinding(finding, input.currentFindings);
      if (!currentFinding) {
        return null;
      }

      return markReviewFindingRegression(finding, {
        manuscriptVersionId: currentFinding.manuscriptVersionId,
        detectedByFindingId: currentFinding.id,
        regressedAt: input.checkedAt
      });
    })
    .filter((transition): transition is ReviewLearningTransition => transition !== null);

  return {
    regressions,
    recurringIssues: buildRecurringIssueSummary(input.currentFindings)
  };
}

function findRecurringCurrentFinding(previousFinding: ReviewFinding, currentFindings: ReviewFinding[]): ReviewFinding | null {
  const previousSignature = buildRecheckSignature(previousFinding);
  const sameIssueFindings = currentFindings.filter((finding) => buildRecheckSignature(finding) === previousSignature);

  return (
    sameIssueFindings.find((finding) => getFirstSourceId(finding) === getFirstSourceId(previousFinding)) ??
    sameIssueFindings[0] ??
    null
  );
}

function buildRecheckSignature(finding: ReviewFinding): string {
  return `${finding.category}:${finding.problem.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}`;
}

function getFirstSourceId(finding: ReviewFinding): string | undefined {
  return finding.evidenceCitations[0]?.sourceId;
}
