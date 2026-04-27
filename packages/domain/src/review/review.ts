export type ReviewSeverity = 'Low' | 'Medium' | 'High' | 'Blocking';
export type ReviewFindingStatus = 'Open' | 'Accepted' | 'Applied' | 'Rejected' | 'FalsePositive' | 'Resolved' | 'Regression';
export type RevisionSuggestionStatus = 'Proposed' | 'Applied' | 'Rejected';

export interface ReviewFinding {
  id: string;
  manuscriptVersionId: string;
  category: string;
  severity: ReviewSeverity;
  problem: string;
  evidenceCitations: Array<{ sourceId: string; quote: string }>;
  impact: string;
  fixOptions: string[];
  autoFixRisk: 'Low' | 'Medium' | 'High';
  status: ReviewFindingStatus;
}

export interface ReviewProfile {
  id: string;
  name: string;
  enabledCategories: string[];
}

export interface QualityScore {
  overall: number;
  continuity: number;
  promiseSatisfaction: number;
  prose: number;
}

export interface ReviewReport {
  id: string;
  projectId: string;
  manuscriptVersionId: string;
  profile: ReviewProfile;
  findings: ReviewFinding[];
  qualityScore: QualityScore;
  openFindingCount: number;
}

export interface RevisionSuggestion {
  id: string;
  findingId: string;
  manuscriptVersionId: string;
  title: string;
  rationale: string;
  diff: {
    before: string;
    after: string;
  };
  risk: 'Low' | 'Medium' | 'High';
  status: RevisionSuggestionStatus;
}

export interface FalsePositiveRecord {
  id: string;
  findingId: string;
  reason: string;
  decidedBy: string;
  status: Extract<ReviewFindingStatus, 'FalsePositive'>;
}

export function createReviewFinding(input: Omit<ReviewFinding, 'id' | 'status'>): ReviewFinding {
  return {
    id: `review_finding_${crypto.randomUUID().replace(/-/g, '')}`,
    status: 'Open',
    ...input
  };
}

export function buildReviewReport(input: Omit<ReviewReport, 'id' | 'openFindingCount'>): ReviewReport {
  return {
    id: `review_report_${crypto.randomUUID().replace(/-/g, '')}`,
    openFindingCount: input.findings.filter((finding) => finding.status === 'Open').length,
    ...input
  };
}

export function createRevisionSuggestion(input: Omit<RevisionSuggestion, 'id' | 'status'>): RevisionSuggestion {
  return {
    id: `revision_suggestion_${crypto.randomUUID().replace(/-/g, '')}`,
    status: 'Proposed',
    ...input
  };
}

export function createFalsePositiveRecord(input: Omit<FalsePositiveRecord, 'id' | 'status'>): FalsePositiveRecord {
  return {
    id: `false_positive_${crypto.randomUUID().replace(/-/g, '')}`,
    status: 'FalsePositive',
    ...input
  };
}
