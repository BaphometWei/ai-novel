export interface HealthResponse {
  ok: boolean;
  service: string;
}

export interface ProjectListItem {
  id: string;
  title: string;
}

export type ExternalModelPolicy = 'Allowed' | 'Disabled';

export interface ProjectSummary extends ProjectListItem {
  status?: string;
  externalModelPolicy: ExternalModelPolicy;
}

export interface ChapterSummary {
  id: string;
  title: string;
  manuscriptId?: string;
  currentVersionId?: string;
  versions?: ChapterVersionSummary[];
}

export interface ChapterVersionSummary {
  id: string;
  chapterId?: string;
  versionNumber?: number;
  bodyArtifactId?: string;
  status?: string;
}

export interface ChapterCurrentBody {
  chapterId: string;
  versionId: string;
  body: string;
}

export interface CreateProjectChapterInput {
  title: string;
  order: number;
  body?: string;
  status?: 'Draft' | 'Accepted';
  metadata?: Record<string, unknown>;
}

export interface AddChapterVersionInput {
  body: string;
  status?: 'Draft' | 'Accepted' | 'Rejected' | 'Superseded';
  makeCurrent?: boolean;
  metadata?: Record<string, unknown>;
}

export interface CreateProjectChapterResult {
  chapter: ChapterSummary;
  version: ChapterVersionSummary;
}

export interface WritingRunInput {
  target: {
    manuscriptId: string;
    chapterId: string;
    range: string;
  };
  contract: {
    authorshipLevel: 'A1' | 'A2' | 'A3' | 'A4';
    goal: string;
    mustWrite: string;
    wordRange: { min: number; max: number };
    forbiddenChanges: string[];
    acceptanceCriteria: string[];
  };
  retrieval: {
    query: string;
    maxContextItems?: number;
    maxSectionChars?: number;
  };
}

export interface WritingRunResult {
  id: string;
  status: string;
  manuscriptVersionId: string | null;
  draftArtifact: {
    id: string;
    artifactRecordId?: string;
    type: string;
    status: string;
    text: string;
    contextPackId: string;
  };
  selfCheckArtifact: {
    id: string;
    type: string;
    status: string;
    result: {
      summary: string;
      passed: boolean;
      findings: string[];
    };
  };
  contextPack: AgentRoomContextPack;
}

export interface AcceptDraftInput {
  runId: string;
  draftArtifactId: string;
  body: string;
  acceptedBy: string;
}

export interface AcceptDraftResult {
  status: 'Accepted' | 'PendingApproval';
  projectId: string;
  chapterId: string;
  versionId: string;
  sourceRunId: string;
  draftArtifactId: string;
  approvals: Array<{
    id: string;
    targetType: string;
    targetId: string;
    status: string;
    riskLevel: string;
    reason: string;
  }>;
  candidates: unknown[];
}

export interface ProviderDefaults {
  provider: string;
  defaultModel: string;
  secretRef: string;
  redactedMetadata: Record<string, unknown>;
  updatedAt: string;
}

export interface ModelRoutingDefaults {
  provider: string;
  draftingModel: string;
  reviewModel: string;
  embeddingModel?: string;
  updatedAt: string;
}

export interface BudgetDefaults {
  provider: string;
  maxRunCostUsd: number;
  maxDailyCostUsd?: number;
  maxContextTokens?: number;
  updatedAt: string;
}

export interface SourcePolicyDefaults {
  allowUserSamples: boolean;
  allowLicensedSamples: boolean;
  allowPublicDomain: boolean;
  restrictedSourceIds: string[];
  updatedAt: string;
}

export interface SettingsDefaults {
  provider: ProviderDefaults;
  modelRouting: ModelRoutingDefaults;
  budget: BudgetDefaults;
  sourcePolicy: SourcePolicyDefaults;
}

export interface SaveProviderDefaultsInput {
  model: string;
  apiKey?: string;
  secretRef?: string;
  maxRunCostUsd?: number;
  metadata?: Record<string, unknown>;
}

export type SaveModelRoutingDefaultsInput = Omit<ModelRoutingDefaults, 'updatedAt'>;
export type SaveBudgetDefaultsInput = Omit<BudgetDefaults, 'updatedAt'>;
export type SaveSourcePolicyDefaultsInput = Partial<Omit<SourcePolicyDefaults, 'updatedAt'>>;

export interface AgentRoomRunSummary {
  id: string;
  agentName: string;
  taskType: string;
  workflowType: string;
  promptVersionId: string;
  status: string;
  jobStatus?: string;
  createdAt: string;
  totalCostUsd: number;
  pendingApprovalCount: number;
  allowedActions: string[];
  contextPackId?: string;
}

export interface AgentRoomGraphStep {
  id: string;
  order: number;
  name: string;
  status: string;
  artifactIds: string[];
  retryAttempt: number;
}

export interface AgentRoomContextPack {
  id: string;
  taskGoal: string;
  agentRole: string;
  riskLevel: string;
  sections: Array<{ name: string; content: string }>;
  citations: Array<{ sourceId: string; quote?: string }>;
  exclusions: string[];
  warnings: string[];
  retrievalTrace: string[];
  createdAt: string;
}

export interface AgentRoomArtifact {
  id: string;
  type: string;
  source: string;
  version: number;
  hash: string;
  uri: string;
  relatedRunId?: string;
  createdAt: string;
}

export interface AgentRoomApproval {
  id: string;
  runId?: string;
  status: string;
  title: string;
}

export interface AgentRoomCostCall {
  id: string;
  promptVersionId: string;
  provider: string;
  model: string;
  schemaName?: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  estimatedCostUsd: number;
  retryCount: number;
  status: string;
  createdAt: string;
}

export interface AgentRoomCostSummary {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  calls: AgentRoomCostCall[];
}

export interface AgentRoomDurableJob {
  id: string;
  workflowType: string;
  status: string;
  retryCount: number;
  replayOfJobId?: string;
  lineage: string[];
}

export interface ObservabilityModelUsage {
  modelProvider: string;
  modelName: string;
  runCount: number;
  totalTokens: number;
  totalCostUsd: number;
}

export interface ObservabilityRunError {
  code: string;
  count: number;
  retryableCount: number;
  maxSeverity: string;
}

export interface ObservabilityWorkflowBottleneck {
  workflowType: string;
  stepName: string;
  runCount: number;
  averageDurationMs: number;
  failureRate: number;
  retryPressure: number;
}

export interface ProductObservabilitySummary {
  cost: {
    totalUsd: number;
    averageUsdPerRun: number;
  };
  latency: {
    averageDurationMs: number;
    p95DurationMs: number;
  };
  tokens: {
    total: number;
    averagePerRun: number;
  };
  quality: {
    status?: string;
    acceptedRate: number;
    openIssueCount: number;
    highSeverityOpenCount: number;
    outcomes: Record<string, number>;
  };
  adoption: {
    status?: string;
    adoptedRate: number;
    partialRate: number;
    rejectedRate: number;
    byFeature: Record<string, Record<string, number>>;
  };
  modelUsage: ObservabilityModelUsage[];
  runErrors: ObservabilityRunError[];
  workflowBottlenecks: ObservabilityWorkflowBottleneck[];
  dataQuality?: {
    openIssueCount: number;
    highSeverityOpenCount: number;
  };
}

export interface AgentRoomActionResult {
  runId: string;
  action: string;
  status: string;
  message?: string;
}

export interface AgentRoomRunDetail {
  run: AgentRoomRunSummary;
  workflowRun?: { id: string; taskContractId: string; steps: unknown[] } | null;
  graph: AgentRoomGraphStep[];
  contextPack?: AgentRoomContextPack | null;
  artifacts: AgentRoomArtifact[];
  approvals: AgentRoomApproval[];
  durableJob?: AgentRoomDurableJob | null;
  costSummary: AgentRoomCostSummary;
}

export interface BackupJob {
  id: string;
  type: string;
  status: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  output?: Record<string, unknown>;
  error?: string;
}

export interface BackupWorkflowResult {
  job: BackupJob;
  record?: {
    id: string;
    projectId: string;
    path: string;
    hash: string;
    manifest?: Record<string, unknown>;
    createdAt: string;
    byteLength?: number;
  };
  status: { ok: boolean; stage: string; hash?: string; error?: string };
}

export interface RestoreBackupResult {
  job: BackupJob;
  record?: {
    id: string;
    backupId: string;
    sourceProjectId?: string;
    targetProjectId: string;
    hash: string;
    requestedBy?: string;
    restoredAt: string;
    rollbackActions: Array<{ type: string; targetId: string }>;
  };
  status: { ok: boolean; stage: string; hash?: string; error?: string };
}

export type VersionedEntityType = 'manuscript' | 'canon' | 'prompt' | 'run' | 'context_pack' | 'artifact';

export interface VersionedEntityRef {
  id: string;
  type: VersionedEntityType;
  version: number;
  label: string;
}

export interface VersionTraceLink {
  from: string;
  to: string;
  relation: string;
}

export interface VersionRestorePoint {
  entityId: string;
  version: number;
}

export interface VersionHistoryInput {
  createdAt: string;
  entities: VersionedEntityRef[];
  links: VersionTraceLink[];
}

export interface VersionHistory {
  entities: VersionedEntityRef[];
  trace: {
    links: VersionTraceLink[];
    createdAt: string;
  };
  restorePoints: VersionRestorePoint[];
}

export interface VersionHistorySnapshot {
  id: string;
  projectId: string;
  history: VersionHistory;
  createdAt: string;
}

export type ReviewSeverity = 'Low' | 'Medium' | 'High' | 'Blocking';
export type ReviewFindingStatus = 'Open' | 'Accepted' | 'Applied' | 'Rejected' | 'FalsePositive' | 'Resolved' | 'Regression';

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

export interface ReviewReport {
  id: string;
  projectId: string;
  manuscriptVersionId: string;
  profile: {
    id: string;
    name: string;
    enabledCategories: string[];
  };
  findings: ReviewFinding[];
  qualityScore: {
    overall: number;
    continuity: number;
    promiseSatisfaction: number;
    prose: number;
  };
  openFindingCount: number;
}

export type ReviewFindingActionKind = 'Accepted' | 'Rejected' | 'FalsePositive' | 'ApplyRevision' | 'ConvertToTask';

export interface ReviewFindingActionResult {
  findingId: string;
  action: ReviewFindingActionKind;
  previousStatus: ReviewFindingStatus;
  nextStatus: ReviewFindingStatus;
  decidedBy?: string;
  reason?: string;
  createdTaskId?: string;
  occurredAt: string;
}

export interface RecurringIssueSummary {
  signature: string;
  category: string;
  occurrenceCount: number;
  chapterIds: string[];
  findingIds: string[];
  highestSeverity: ReviewSeverity;
  trend: 'Recurring' | 'Escalating';
  risk: 'Medium' | 'High' | 'Blocking';
}

export interface RecurringIssueSummaryInput {
  findings: ReviewFinding[];
  minimumOccurrences?: number;
}

export interface RecurringIssueSummaryResult {
  recurringIssues: RecurringIssueSummary[];
}

export interface RevisionRecheckInput {
  previousManuscriptVersionId: string;
  currentManuscriptVersionId: string;
  previousFindings: ReviewFinding[];
  currentFindings: ReviewFinding[];
  checkedAt: string;
}

export interface RecheckStatusSummary {
  findingId: string;
  status: 'Resolved' | 'Regressed' | 'StillOpen';
  currentFindingId?: string;
}

export interface ReviewLearningEvent {
  id: string;
  findingId: string;
  kind: 'FalsePositive' | 'Accepted' | 'Rejected' | 'Resolved' | 'Regression';
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

export interface RevisionRecheckResult {
  previousManuscriptVersionId: string;
  currentManuscriptVersionId: string;
  statuses: RecheckStatusSummary[];
  regressions: ReviewLearningTransition[];
  recurringIssues: RecurringIssueSummary[];
}

export interface ApiClient {
  fetchHealth(): Promise<HealthResponse>;
  listProjects(): Promise<ProjectListItem[]>;
  getProjectSummary(projectId: string): Promise<ProjectSummary>;
  updateProjectExternalModelPolicy(projectId: string, policy: ExternalModelPolicy): Promise<ProjectSummary>;
  listProjectChapters(projectId: string): Promise<ChapterSummary[]>;
  getChapterCurrentBody(chapterId: string): Promise<ChapterCurrentBody | null>;
}

export interface WritingManuscriptApiClient {
  createProjectChapter(projectId: string, input: CreateProjectChapterInput): Promise<CreateProjectChapterResult>;
  addChapterVersion(chapterId: string, input: AddChapterVersionInput): Promise<ChapterVersionSummary>;
  acceptDraft(chapterId: string, input: AcceptDraftInput): Promise<AcceptDraftResult>;
  startWritingRun(projectId: string, input: WritingRunInput): Promise<WritingRunResult>;
}

export type GlobalSearchResultType = 'manuscript' | 'canon' | 'knowledge' | 'runs' | 'review' | 'feedback';

export interface GlobalSearchResult {
  id: string;
  projectId: string;
  type: GlobalSearchResultType;
  title: string;
  snippet: string;
  score?: number;
}

export interface GlobalSearchInput {
  projectId: string;
  query: string;
  types?: GlobalSearchResultType[];
}

export interface SearchApiClient {
  globalSearch(input: GlobalSearchInput): Promise<GlobalSearchResult[]>;
}

export interface SettingsApiClient {
  loadSettingsDefaults(provider?: string): Promise<SettingsDefaults>;
  saveProviderDefaults(provider: string, input: SaveProviderDefaultsInput): Promise<ProviderDefaults>;
  saveModelRoutingDefaults(input: SaveModelRoutingDefaultsInput): Promise<ModelRoutingDefaults>;
  saveBudgetDefaults(input: SaveBudgetDefaultsInput): Promise<BudgetDefaults>;
  saveSourcePolicyDefaults(input: SaveSourcePolicyDefaultsInput): Promise<SourcePolicyDefaults>;
}

export interface AgentRoomApiClient {
  listAgentRoomRuns(): Promise<AgentRoomRunSummary[]>;
  getAgentRoomRun(runId: string): Promise<AgentRoomRunDetail>;
  runAgentRoomAction(runId: string, action: string): Promise<AgentRoomActionResult>;
}

export interface ObservabilityApiClient {
  loadObservabilitySummary(input?: { projectId?: string }): Promise<ProductObservabilitySummary>;
}

export interface ApprovalItem {
  id: string;
  projectId?: string;
  kind?: string;
  targetType?: string;
  targetId?: string;
  title: string;
  riskLevel?: string;
  reason?: string;
  proposedAction?: string;
  status: string;
  createdAt?: string;
}

export interface ApprovalsApiClient {
  listPendingApprovals(input?: { projectId?: string }): Promise<ApprovalItem[]>;
  approve(id: string, input?: { decidedBy?: string; note?: string }): Promise<ApprovalItem>;
  reject(id: string, input?: { decidedBy?: string; note?: string }): Promise<ApprovalItem>;
}

export interface BackupApiClient {
  createProjectBackup(
    projectId: string,
    input: { reason?: string; requestedBy?: string }
  ): Promise<BackupWorkflowResult>;
  verifyBackup(path: string): Promise<BackupWorkflowResult>;
  restoreBackup(input: { path: string; targetProjectId: string; requestedBy?: string }): Promise<RestoreBackupResult>;
}

export interface ImportExportApiClient {
  enqueueImportJob(input: { projectId: string; sourceUri: string; mode?: 'replace' | 'merge' }): Promise<unknown>;
  enqueueExportBundle(input: { projectId: string; includeArtifacts?: boolean }): Promise<unknown>;
  getExportBundle(id: string): Promise<unknown>;
}

export interface VersionHistoryApiClient {
  listVersionHistorySnapshots(projectId: string): Promise<VersionHistorySnapshot[]>;
  createVersionHistorySnapshot(projectId: string, input: VersionHistoryInput): Promise<VersionHistorySnapshot>;
  getVersionHistorySnapshot(projectId: string, snapshotId: string): Promise<VersionHistorySnapshot>;
}

export interface ReviewLearningApiClient {
  summarizeRecurringIssues(input: RecurringIssueSummaryInput): Promise<RecurringIssueSummaryResult>;
  recheckRevisionReview(input: RevisionRecheckInput): Promise<RevisionRecheckResult>;
}

export interface ReviewApiClient {
  listReviewReports(projectId: string): Promise<ReviewReport[]>;
  recordReviewFindingAction(
    findingId: string,
    input: { projectId: string; action: ReviewFindingActionKind; decidedBy?: string; reason?: string }
  ): Promise<ReviewFindingActionResult>;
}

export interface NarrativeIntelligenceApiClient {
  getNarrativeIntelligenceSummary(
    projectId: string,
    input?: { currentChapter?: number }
  ): Promise<NarrativeIntelligenceSummary>;
  inspectReaderPromise(input: ReaderPromiseInspectInput): Promise<ReaderPromiseInspectResult>;
  inspectClosureChecklist(input: ClosureChecklistInput): Promise<ClosureChecklistResult>;
}

export interface GovernanceApiClient {
  inspectAuthorshipAudit(input: AuthorshipAuditInput): Promise<AuthorshipAuditResult>;
  listAuditFindingsByTarget(projectId: string, targetType: string, targetId: string): Promise<PersistedAuditFinding[]>;
  listApprovalReferencesByTarget(
    projectId: string,
    targetType: string,
    targetId: string
  ): Promise<PersistedApprovalReference[]>;
}

export interface RetrievalEvaluationApiClient {
  getQualityThresholds(): Promise<QualityThresholdConfig>;
  runProjectRetrievalRegression(
    projectId: string,
    input: RetrievalProjectRegressionInput
  ): Promise<RetrievalRegressionResult>;
  evaluateRetrievalRegression(input: RetrievalRegressionInput): Promise<RetrievalRegressionResult>;
}

export interface BranchRetconApiClient {
  projectBranchScenario(input: BranchProjectInput): Promise<BranchProjectResult>;
  adoptBranchScenario(input: BranchAdoptInput): Promise<BranchAdoptResult>;
  createRetconProposal(input: RetconProposalInput): Promise<RetconProposalResult>;
  runRetconRegressionChecks(input: RegressionRunInput): Promise<RegressionRunResult>;
  listBranchScenarios(projectId: string): Promise<PersistedBranchScenario[]>;
  listRetconProposalsByTarget(projectId: string, targetType: string, targetId: string): Promise<PersistedRetconProposal[]>;
  listRegressionCheckRuns(projectId: string, proposalId: string): Promise<PersistedRegressionCheckRun[]>;
}

export interface ScheduledBackupApiClient {
  upsertScheduledBackupPolicy(id: string, input: ScheduledBackupPolicyInput): Promise<ScheduledBackupPolicy>;
  listScheduledBackupPolicies(): Promise<ScheduledBackupPolicy[]>;
  listDueScheduledBackups(now: string): Promise<ScheduledBackupDueResult>;
  recordScheduledBackupRun(id: string, input: ScheduledBackupRunInput): Promise<ScheduledBackupPolicy>;
}

export interface ReaderPromiseInspectInput {
  promise: Record<string, unknown>;
  currentChapter: number;
  relatedEntitiesInScene: Array<Record<string, unknown>>;
  evidence?: Array<Record<string, unknown>>;
}

export interface ReaderPromiseInspectResult {
  promise: Record<string, unknown>;
  health: string;
  uiState: string | Record<string, unknown>;
  recommendation: Record<string, unknown>;
}

export interface ClosureChecklistInput {
  projectId: string;
  promises: Array<Record<string, unknown>>;
  characterArcs: Array<Record<string, unknown>>;
}

export interface ClosureChecklistResult {
  projectId: string;
  readyCount: number;
  blockerCount: number;
  blockers: Array<Record<string, unknown>>;
}

export interface NarrativeIntelligenceSummary {
  projectId: string;
  currentChapter: number;
  promiseStates: Array<{
    id: string;
    title: string;
    health: string;
    uiState: string | Record<string, unknown>;
    recommendation: Record<string, unknown>;
  }>;
  closure: ClosureChecklistResult;
}

export interface AuthorshipAuditInput {
  projectId: string;
  source: Record<string, unknown>;
  actor: Record<string, unknown>;
  action: string;
  target: Record<string, unknown>;
  transition: Record<string, unknown>;
  inspectedAt?: string;
}

export interface AuthorshipAuditResult {
  allowed: boolean;
  action: string;
  status?: string;
  approvalRequired?: boolean;
  approvalReasons?: string[];
  blockers?: string[];
}

export interface PersistedAuditFinding {
  id: string;
  projectId: string;
  targetType: string;
  targetId: string;
  finding: Record<string, unknown> & {
    code?: string;
    riskLevel?: string;
    message?: string;
    requiredApproval?: boolean;
  };
  createdAt: string;
}

export interface PersistedApprovalReference {
  id: string;
  projectId: string;
  targetType: string;
  targetId: string;
  approvalRequestId: string;
  status: string;
  riskLevel: string;
  reason: string;
  createdAt: string;
}

export interface RetrievalRegressionItem {
  id: string;
  text?: string;
}

export interface RetrievalRegressionExcludedItem {
  id: string;
  reason: string;
}

export interface RetrievalRegressionInput {
  caseId: string;
  projectId: string;
  query: string;
  policy: { id: string; description?: string };
  mustInclude: RetrievalRegressionItem[];
  forbidden: RetrievalRegressionItem[];
  included: RetrievalRegressionItem[];
  excluded: RetrievalRegressionExcludedItem[];
  thresholds?: RetrievalQualityThresholds;
}

export interface RetrievalProjectRegressionInput {
  caseId: string;
  query: string;
  policy: { id: string; description?: string };
  mustInclude: RetrievalRegressionItem[];
  forbidden: RetrievalRegressionItem[];
  thresholds?: RetrievalQualityThresholds;
  maxResults?: number;
  types?: Array<'manuscript' | 'canon' | 'knowledge' | 'runs' | 'review' | 'feedback'>;
}

export interface RetrievalQualityThresholds {
  requiredCoverage: number;
  forbiddenLeakage: number;
}

export interface QualityThresholdConfig {
  source: string;
  retrieval: RetrievalQualityThresholds;
}

export interface RetrievalRegressionFailure {
  kind: string;
  id: string;
  message?: string;
}

export interface RetrievalRegressionTriageHint {
  itemId: string;
  severity: string;
  message: string;
}

export interface RetrievalRegressionResult {
  caseId: string;
  projectId: string;
  query: string;
  policyId: string;
  passed: boolean;
  summary: {
    includedCount: number;
    excludedCount: number;
    failureCount: number;
  };
  thresholds: {
    requiredCoverage: number;
    forbiddenLeakage: number;
  };
  includedIds: string[];
  excludedIds: string[];
  triageHints: RetrievalRegressionTriageHint[];
  included: RetrievalRegressionItem[];
  excluded: RetrievalRegressionExcludedItem[];
  failures: RetrievalRegressionFailure[];
}

export interface BranchCanon {
  canonFactIds: string[];
  artifactIds: string[];
}

export interface BranchArtifact {
  id: string;
  kind: string;
  content: string;
}

export interface BranchScenarioInput {
  projectId: string;
  title: string;
  baseCanonFactIds: string[];
  artifacts: BranchArtifact[];
}

export interface BranchScenario extends BranchScenarioInput {
  id: string;
}

export interface PersistedBranchScenario {
  id: string;
  projectId: string;
  name: string;
  baseRef: Record<string, unknown>;
  hypothesis: string;
  status: string;
  payload: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface BranchProjectInput {
  canon: BranchCanon;
  scenario: BranchScenarioInput;
}

export interface BranchProjectResult {
  scenario: BranchScenario;
  projection: Record<string, unknown>;
}

export interface BranchAdoptInput {
  canon: BranchCanon;
  scenario: BranchScenario;
}

export interface BranchAdoptResult {
  canon: BranchCanon;
}

export interface RetconProposalInput {
  projectId: string;
  target: Record<string, unknown>;
  before: string;
  after: string;
  affected: Record<string, unknown>;
}

export interface NarrativeRegressionCheck {
  scope: string;
  status: string;
  evidence: string[];
}

export interface RegressionRunInput {
  projectId?: string;
  proposalId?: string;
  checks: NarrativeRegressionCheck[];
}

export interface RegressionRunResult {
  passed: boolean;
  checks: NarrativeRegressionCheck[];
}

export interface RetconProposalResult {
  proposal: Record<string, unknown> & {
    id?: string;
    title?: string;
    regressionChecks?: NarrativeRegressionCheck[];
  };
  regression: RegressionRunResult;
}

export type PersistedRetconProposal = Record<string, unknown> & {
  id: string;
  projectId: string;
  target?: Record<string, unknown>;
  status: string;
  createdAt?: string;
  updatedAt?: string;
};

export interface PersistedRegressionCheckRun {
  id: string;
  projectId: string;
  proposalId: string;
  status: string;
  checks: unknown[];
  createdAt: string;
}

export interface ScheduledBackupPolicyInput {
  projectId: string;
  cadence: string;
  targetPathPrefix: string;
  enabled: boolean;
  lastRunAt?: string;
  nextRunAt: string;
  retentionCount: number;
  lastRunStatus?: 'Succeeded' | 'Failed';
}

export interface ScheduledBackupPolicy extends ScheduledBackupPolicyInput {
  id: string;
}

export interface ScheduledBackupIntent {
  id: string;
  policyId: string;
  projectId: string;
  targetPathPrefix: string;
  scheduledAt: string;
}

export interface ScheduledBackupDueResult {
  policies: ScheduledBackupPolicy[];
  intents: ScheduledBackupIntent[];
}

export interface ScheduledBackupRunInput {
  completedAt: string;
  status: 'Succeeded' | 'Failed';
}

export type FetchImpl = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface ApiClientOptions {
  baseUrl?: string;
  fetchImpl?: FetchImpl;
}

export function resolveApiBaseUrl(env?: { VITE_API_BASE_URL?: string | undefined }): string {
  return env?.VITE_API_BASE_URL ?? '/api';
}

export function createApiClient(
  options: ApiClientOptions = {}
): ApiClient &
  SettingsApiClient &
  AgentRoomApiClient &
  ObservabilityApiClient &
  BackupApiClient &
  SearchApiClient &
  ApprovalsApiClient &
  ImportExportApiClient &
  VersionHistoryApiClient &
  ReviewApiClient &
  ReviewLearningApiClient &
  NarrativeIntelligenceApiClient &
  GovernanceApiClient &
  RetrievalEvaluationApiClient &
  BranchRetconApiClient &
  ScheduledBackupApiClient &
  WritingManuscriptApiClient {
  const baseUrl = options.baseUrl ?? '';
  const fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);

  return {
    fetchHealth: () => fetchHealth(baseUrl, fetchImpl),
    listProjects: async () => adaptProjectList(await requestJson(fetchImpl, `${baseUrl}/projects`)),
    getProjectSummary: async (projectId) => adaptProjectSummary(await requestJson(fetchImpl, `${baseUrl}/projects/${projectId}`)),
    updateProjectExternalModelPolicy: async (projectId, policy) =>
      adaptProjectSummary(
        await requestJson(
          fetchImpl,
          `${baseUrl}/projects/${projectId}/external-model-policy`,
          jsonRequest('PATCH', { externalModelPolicy: policy })
        )
      ),
    listProjectChapters: async (projectId) =>
      adaptChapterList(await requestJson(fetchImpl, `${baseUrl}/projects/${projectId}/chapters`)),
    getChapterCurrentBody: async (chapterId) =>
      adaptChapterCurrentBody(await requestJsonOrNull(fetchImpl, `${baseUrl}/chapters/${chapterId}/current-body`)),
    createProjectChapter: async (projectId, input) =>
      adaptCreateProjectChapterResult(
        await requestJson(fetchImpl, `${baseUrl}/projects/${projectId}/chapters`, jsonRequest('POST', input))
      ),
    addChapterVersion: async (chapterId, input) =>
      adaptChapterVersionResponse(
        await requestJson(fetchImpl, `${baseUrl}/chapters/${chapterId}/versions`, jsonRequest('POST', input))
      ),
    acceptDraft: async (chapterId, input) =>
      adaptAcceptDraftResult(
        await requestJson(fetchImpl, `${baseUrl}/chapters/${chapterId}/accept-draft`, jsonRequest('POST', input))
      ),
    startWritingRun: async (projectId, input) =>
      adaptWritingRunResult(
        await requestJson(fetchImpl, `${baseUrl}/projects/${projectId}/writing-runs`, jsonRequest('POST', input))
      ),
    loadSettingsDefaults: async (provider = 'openai') => ({
      provider: adaptProviderDefaults(await requestJson(fetchImpl, `${baseUrl}/settings/providers/${provider}`)),
      modelRouting: adaptModelRoutingDefaults(await requestJson(fetchImpl, `${baseUrl}/settings/model-routing/defaults`)),
      budget: adaptBudgetDefaults(await requestJson(fetchImpl, `${baseUrl}/settings/budgets/defaults`)),
      sourcePolicy: adaptSourcePolicyDefaults(await requestJson(fetchImpl, `${baseUrl}/settings/source-policy/defaults`))
    }),
    saveProviderDefaults: async (provider, input) =>
      adaptProviderDefaults(
        await requestJson(fetchImpl, `${baseUrl}/settings/providers/${provider}`, jsonRequest('PUT', input))
      ),
    saveModelRoutingDefaults: async (input) =>
      adaptModelRoutingDefaults(
        await requestJson(fetchImpl, `${baseUrl}/settings/model-routing/defaults`, jsonRequest('PUT', input))
      ),
    saveBudgetDefaults: async (input) =>
      adaptBudgetDefaults(await requestJson(fetchImpl, `${baseUrl}/settings/budgets/defaults`, jsonRequest('PUT', input))),
    saveSourcePolicyDefaults: async (input) =>
      adaptSourcePolicyDefaults(
        await requestJson(fetchImpl, `${baseUrl}/settings/source-policy/defaults`, jsonRequest('PUT', input))
      ),
    listAgentRoomRuns: async () => adaptAgentRoomRunList(await requestJson(fetchImpl, `${baseUrl}/agent-room/runs`)),
    getAgentRoomRun: async (runId) =>
      adaptAgentRoomRunDetail(await requestJson(fetchImpl, `${baseUrl}/agent-room/runs/${runId}`)),
    runAgentRoomAction: async (runId, action) =>
      adaptAgentRoomActionResult(
        await requestJson(fetchImpl, `${baseUrl}/agent-room/runs/${runId}/actions/${action}`, jsonRequest('POST', {}))
      ),
    loadObservabilitySummary: async (input) =>
      adaptProductObservabilitySummary(
        await requestJson(
          fetchImpl,
          input?.projectId
            ? `${baseUrl}/projects/${input.projectId}/observability/summary`
            : `${baseUrl}/observability/summary`
        )
      ),
    createProjectBackup: async (projectId, input) =>
      adaptBackupWorkflowResult(
        await requestJson(fetchImpl, `${baseUrl}/projects/${projectId}/backups`, jsonRequest('POST', compact(input)))
      ),
    verifyBackup: async (path) =>
      adaptBackupWorkflowResult(await requestJson(fetchImpl, `${baseUrl}/backups/verify`, jsonRequest('POST', { path }))),
    restoreBackup: async (input) =>
      adaptRestoreBackupResult(await requestJson(fetchImpl, `${baseUrl}/backups/restore`, jsonRequest('POST', compact(input)))),
    globalSearch: async (input: GlobalSearchInput) => {
      const result = await requestJson(fetchImpl, `${baseUrl}/search`, jsonRequest('POST', input));
      if (isRecord(result) && Array.isArray((result as Record<string, unknown>).results)) {
        return ((result as Record<string, unknown>).results as unknown[]).flatMap((r) => (isRecord(r) ? [adaptGlobalResult(r)] : []));
      }
      return [] as GlobalSearchResult[];
    },
    listPendingApprovals: async (input?: { projectId?: string }) => {
      const result = await requestJson(fetchImpl, `${baseUrl}/approvals`);
      const items = isRecord(result) && Array.isArray(result.items) ? result.items : [];
      const approvals = (items as unknown[]).flatMap((it) => (isRecord(it) ? [adaptApprovalItem(it)] : []));
      return input?.projectId ? approvals.filter((item) => item.projectId === input.projectId) : approvals;
    },
    approve: async (id: string, input?: { decidedBy?: string; note?: string }) => {
      const result = await requestJson(fetchImpl, `${baseUrl}/approvals/${id}/approve`, jsonRequest('POST', input ?? {}));
      if (!isRecord(result)) throw new Error('Invalid approval response');
      return adaptApprovalItem(result);
    },
    reject: async (id: string, input?: { decidedBy?: string; note?: string }) => {
      const result = await requestJson(fetchImpl, `${baseUrl}/approvals/${id}/reject`, jsonRequest('POST', input ?? {}));
      if (!isRecord(result)) throw new Error('Invalid approval response');
      return adaptApprovalItem(result);
    },
    enqueueImportJob: async (input: { projectId: string; sourceUri: string; mode?: 'replace' | 'merge' }) =>
      await requestJson(fetchImpl, `${baseUrl}/imports/jobs`, jsonRequest('POST', input)),
    enqueueExportBundle: async (input: { projectId: string; includeArtifacts?: boolean }) =>
      await requestJson(fetchImpl, `${baseUrl}/exports/bundles`, jsonRequest('POST', input)),
    getExportBundle: async (id: string) => await requestJson(fetchImpl, `${baseUrl}/exports/bundles/${id}`),
    listVersionHistorySnapshots: async (projectId) =>
      adaptVersionHistorySnapshotList(await requestJson(fetchImpl, `${baseUrl}/version-history/${projectId}`)),
    createVersionHistorySnapshot: async (projectId, input) =>
      adaptVersionHistorySnapshot(
        await requestJson(fetchImpl, `${baseUrl}/version-history/${projectId}/snapshots`, jsonRequest('POST', input))
      ),
    getVersionHistorySnapshot: async (projectId, snapshotId) =>
      adaptVersionHistorySnapshot(
        await requestJson(fetchImpl, `${baseUrl}/version-history/${projectId}/snapshots/${snapshotId}`)
      ),
    listReviewReports: async (projectId) =>
      adaptReviewReportList(await requestJson(fetchImpl, `${baseUrl}/projects/${projectId}/review/reports`)),
    recordReviewFindingAction: async (findingId, input) =>
      adaptReviewFindingActionResult(
        await requestJson(fetchImpl, `${baseUrl}/review/findings/${findingId}/actions`, jsonRequest('POST', input))
      ),
    summarizeRecurringIssues: async (input) =>
      adaptRecurringIssueSummaryResult(
        await requestJson(fetchImpl, `${baseUrl}/review-learning/recurring-issues`, jsonRequest('POST', input))
      ),
    recheckRevisionReview: async (input) =>
      adaptRevisionRecheckResult(await requestJson(fetchImpl, `${baseUrl}/review-learning/recheck`, jsonRequest('POST', input))),
    getNarrativeIntelligenceSummary: async (projectId, input) => {
      const query = input?.currentChapter ? `?currentChapter=${encodeURIComponent(String(input.currentChapter))}` : '';
      return adaptNarrativeIntelligenceSummary(
        await requestJson(
          fetchImpl,
          `${baseUrl}/narrative-intelligence/projects/${encodeURIComponent(projectId)}/summary${query}`
        )
      );
    },
    inspectReaderPromise: async (input) =>
      adaptReaderPromiseInspectResult(
        await requestJson(fetchImpl, `${baseUrl}/narrative-intelligence/reader-promises/inspect`, jsonRequest('POST', input))
      ),
    inspectClosureChecklist: async (input) =>
      adaptClosureChecklistResult(
        await requestJson(fetchImpl, `${baseUrl}/narrative-intelligence/closure-checklist/inspect`, jsonRequest('POST', input))
      ),
    inspectAuthorshipAudit: async (input) =>
      adaptAuthorshipAuditResult(
        await requestJson(fetchImpl, `${baseUrl}/governance/authorship-audit/inspect`, jsonRequest('POST', input))
      ),
    listAuditFindingsByTarget: async (projectId, targetType, targetId) =>
      adaptPersistedAuditFindings(
        await requestJson(
          fetchImpl,
          `${baseUrl}/governance/projects/${encodeURIComponent(projectId)}/targets/${encodeURIComponent(
            targetType
          )}/${encodeURIComponent(targetId)}/audit-findings`
        )
      ),
    listApprovalReferencesByTarget: async (projectId, targetType, targetId) =>
      adaptPersistedApprovalReferences(
        await requestJson(
          fetchImpl,
          `${baseUrl}/governance/projects/${encodeURIComponent(projectId)}/targets/${encodeURIComponent(
            targetType
          )}/${encodeURIComponent(targetId)}/approval-references`
        )
      ),
    getQualityThresholds: async () =>
      adaptQualityThresholdConfig(await requestJson(fetchImpl, `${baseUrl}/retrieval/quality-thresholds`)),
    runProjectRetrievalRegression: async (projectId, input) =>
      adaptRetrievalRegressionResult(
        await requestJson(
          fetchImpl,
          `${baseUrl}/retrieval/projects/${encodeURIComponent(projectId)}/regression/run`,
          jsonRequest('POST', input)
        )
      ),
    evaluateRetrievalRegression: async (input) =>
      adaptRetrievalRegressionResult(
        await requestJson(fetchImpl, `${baseUrl}/retrieval/regression/evaluate`, jsonRequest('POST', input))
      ),
    projectBranchScenario: async (input) =>
      adaptBranchProjectResult(
        await requestJson(fetchImpl, `${baseUrl}/branch-retcon/branches/project`, jsonRequest('POST', input))
      ),
    adoptBranchScenario: async (input) =>
      adaptBranchAdoptResult(await requestJson(fetchImpl, `${baseUrl}/branch-retcon/branches/adopt`, jsonRequest('POST', input))),
    createRetconProposal: async (input) =>
      adaptRetconProposalResult(
        await requestJson(fetchImpl, `${baseUrl}/branch-retcon/retcons/propose`, jsonRequest('POST', input))
      ),
    runRetconRegressionChecks: async (input) =>
      adaptRegressionRunResult(
        await requestJson(fetchImpl, `${baseUrl}/branch-retcon/retcons/regression-checks/run`, jsonRequest('POST', input))
      ),
    listBranchScenarios: async (projectId) =>
      adaptPersistedBranchScenarios(
        await requestJson(fetchImpl, `${baseUrl}/branch-retcon/projects/${encodeURIComponent(projectId)}/branches/scenarios`)
      ),
    listRetconProposalsByTarget: async (projectId, targetType, targetId) =>
      adaptPersistedRetconProposals(
        await requestJson(
          fetchImpl,
          `${baseUrl}/branch-retcon/projects/${encodeURIComponent(projectId)}/targets/${encodeURIComponent(
            targetType
          )}/${encodeURIComponent(targetId)}/retcon-proposals`
        )
      ),
    listRegressionCheckRuns: async (projectId, proposalId) =>
      adaptPersistedRegressionCheckRuns(
        await requestJson(
          fetchImpl,
          `${baseUrl}/branch-retcon/projects/${encodeURIComponent(projectId)}/retcon-proposals/${encodeURIComponent(
            proposalId
          )}/regression-check-runs`
        )
      ),
    upsertScheduledBackupPolicy: async (id, input) =>
      adaptScheduledBackupPolicy(
        await requestJson(fetchImpl, `${baseUrl}/scheduled-backups/policies/${id}`, jsonRequest('PUT', input))
      ),
    listScheduledBackupPolicies: async () =>
      adaptScheduledBackupPolicyList(await requestJson(fetchImpl, `${baseUrl}/scheduled-backups/policies`)),
    listDueScheduledBackups: async (now) =>
      adaptScheduledBackupDueResult(
        await requestJson(fetchImpl, `${baseUrl}/scheduled-backups/due?now=${encodeURIComponent(now)}`)
      ),
    recordScheduledBackupRun: async (id, input) =>
      adaptScheduledBackupPolicy(
        await requestJson(fetchImpl, `${baseUrl}/scheduled-backups/policies/${id}/runs`, jsonRequest('POST', input))
      )
  };
}

function adaptReaderPromiseInspectResult(value: unknown): ReaderPromiseInspectResult {
  if (!isRecord(value)) throw new Error('Invalid reader promise inspect response');
  return {
    promise: isRecord(value.promise) ? value.promise : {},
    health: stringOrFallback(value.health, ''),
    uiState: typeof value.uiState === 'string' || isRecord(value.uiState) ? value.uiState : {},
    recommendation: isRecord(value.recommendation) ? value.recommendation : {}
  };
}

function adaptClosureChecklistResult(value: unknown): ClosureChecklistResult {
  if (!isRecord(value)) throw new Error('Invalid closure checklist response');
  const items = Array.isArray(value.items) ? value.items.filter(isRecord) : [];
  const blockers = Array.isArray(value.blockers) ? value.blockers.filter(isRecord) : items.map(adaptClosureChecklistItem);
  return {
    projectId: stringOrFallback(value.projectId, ''),
    readyCount: numberOrFallback(value.readyCount, 0),
    blockerCount: numberOrFallback(value.blockerCount, blockers.length),
    blockers
  };
}

function adaptNarrativeIntelligenceSummary(value: unknown): NarrativeIntelligenceSummary {
  if (!isRecord(value)) throw new Error('Invalid narrative intelligence summary response');
  return {
    projectId: stringOrFallback(value.projectId, ''),
    currentChapter: numberOrFallback(value.currentChapter, 0),
    promiseStates: Array.isArray(value.promiseStates)
      ? value.promiseStates.filter(isRecord).map(adaptNarrativePromiseState)
      : [],
    closure: adaptClosureChecklistResult(isRecord(value.closure) ? value.closure : {})
  };
}

function adaptNarrativePromiseState(value: Record<string, unknown>): NarrativeIntelligenceSummary['promiseStates'][number] {
  return {
    id: stringOrFallback(value.id, ''),
    title: stringOrFallback(value.title, ''),
    health: stringOrFallback(value.health, ''),
    uiState: typeof value.uiState === 'string' || isRecord(value.uiState) ? value.uiState : '',
    recommendation: isRecord(value.recommendation) ? value.recommendation : {}
  };
}

function adaptClosureChecklistItem(value: Record<string, unknown>): Record<string, unknown> {
  return {
    id: stringOrFallback(value.sourceId, stringOrFallback(value.id, '')),
    type: stringOrFallback(value.sourceType, stringOrFallback(value.type, '')),
    label: stringOrFallback(value.label, stringOrFallback(value.sourceId, '')),
    reason: stringOrFallback(value.risk, stringOrFallback(value.status, ''))
  };
}

function adaptAuthorshipAuditResult(value: unknown): AuthorshipAuditResult {
  if (!isRecord(value)) throw new Error('Invalid authorship audit response');
  return {
    allowed: value.allowed === true,
    action: stringOrFallback(value.action, ''),
    status: typeof value.status === 'string' ? value.status : undefined,
    approvalRequired: typeof value.approvalRequired === 'boolean' ? value.approvalRequired : undefined,
    approvalReasons: stringArrayOrEmpty(value.approvalReasons),
    blockers: stringArrayOrEmpty(value.blockers)
  };
}

function adaptPersistedAuditFindings(value: unknown): PersistedAuditFinding[] {
  return Array.isArray(value) ? value.filter(isRecord).map(adaptPersistedAuditFinding) : [];
}

function adaptPersistedAuditFinding(value: Record<string, unknown>): PersistedAuditFinding {
  return {
    id: stringOrFallback(value.id, ''),
    projectId: stringOrFallback(value.projectId, ''),
    targetType: stringOrFallback(value.targetType, ''),
    targetId: stringOrFallback(value.targetId, ''),
    finding: isRecord(value.finding) ? value.finding : {},
    createdAt: stringOrFallback(value.createdAt, '')
  };
}

function adaptPersistedApprovalReferences(value: unknown): PersistedApprovalReference[] {
  return Array.isArray(value) ? value.filter(isRecord).map(adaptPersistedApprovalReference) : [];
}

function adaptPersistedApprovalReference(value: Record<string, unknown>): PersistedApprovalReference {
  return {
    id: stringOrFallback(value.id, ''),
    projectId: stringOrFallback(value.projectId, ''),
    targetType: stringOrFallback(value.targetType, ''),
    targetId: stringOrFallback(value.targetId, ''),
    approvalRequestId: stringOrFallback(value.approvalRequestId, ''),
    status: stringOrFallback(value.status, ''),
    riskLevel: stringOrFallback(value.riskLevel, ''),
    reason: stringOrFallback(value.reason, ''),
    createdAt: stringOrFallback(value.createdAt, '')
  };
}

function adaptRetrievalRegressionResult(value: unknown): RetrievalRegressionResult {
  if (!isRecord(value) || !isRecord(value.summary)) throw new Error('Invalid retrieval regression response');
  return {
    caseId: stringOrFallback(value.caseId, ''),
    projectId: stringOrFallback(value.projectId, ''),
    query: stringOrFallback(value.query, ''),
    policyId: stringOrFallback(value.policyId, ''),
    passed: value.passed === true,
    summary: {
      includedCount: numberOrFallback(value.summary.includedCount, 0),
      excludedCount: numberOrFallback(value.summary.excludedCount, 0),
      failureCount: numberOrFallback(value.summary.failureCount, 0)
    },
    thresholds: isRecord(value.thresholds)
      ? {
          requiredCoverage: numberOrFallback(value.thresholds.requiredCoverage, 0),
          forbiddenLeakage: numberOrFallback(value.thresholds.forbiddenLeakage, 0)
        }
      : { requiredCoverage: 0, forbiddenLeakage: 0 },
    includedIds: stringArrayOrEmpty(value.includedIds),
    excludedIds: stringArrayOrEmpty(value.excludedIds),
    triageHints: Array.isArray(value.triageHints)
      ? value.triageHints.filter(isRecord).map(adaptRetrievalRegressionTriageHint)
      : [],
    included: Array.isArray(value.included) ? value.included.filter(isRecord).map(adaptRetrievalRegressionItem) : [],
    excluded: Array.isArray(value.excluded) ? value.excluded.filter(isRecord).map(adaptRetrievalRegressionExcludedItem) : [],
    failures: Array.isArray(value.failures) ? value.failures.filter(isRecord).map(adaptRetrievalRegressionFailure) : []
  };
}

function adaptQualityThresholdConfig(value: unknown): QualityThresholdConfig {
  const source = isRecord(value) ? stringOrFallback(value.source, 'synthetic-local-defaults') : 'synthetic-local-defaults';
  const retrieval = isRecord(value) && isRecord(value.retrieval) ? value.retrieval : {};

  return {
    source,
    retrieval: {
      requiredCoverage: numberOrFallback(retrieval.requiredCoverage, 1),
      forbiddenLeakage: numberOrFallback(retrieval.forbiddenLeakage, 0)
    }
  };
}

function adaptRetrievalRegressionItem(value: Record<string, unknown>): RetrievalRegressionItem {
  return {
    id: stringOrFallback(value.id, ''),
    text: typeof value.text === 'string' ? value.text : undefined
  };
}

function adaptRetrievalRegressionExcludedItem(value: Record<string, unknown>): RetrievalRegressionExcludedItem {
  return {
    id: stringOrFallback(value.id, ''),
    reason: stringOrFallback(value.reason, '')
  };
}

function adaptRetrievalRegressionFailure(value: Record<string, unknown>): RetrievalRegressionFailure {
  return {
    kind: stringOrFallback(value.kind, ''),
    id: stringOrFallback(value.id, ''),
    message: typeof value.message === 'string' ? value.message : undefined
  };
}

function adaptRetrievalRegressionTriageHint(value: Record<string, unknown>): RetrievalRegressionTriageHint {
  return {
    itemId: stringOrFallback(value.itemId, ''),
    severity: stringOrFallback(value.severity, ''),
    message: stringOrFallback(value.message, '')
  };
}

function adaptBranchProjectResult(value: unknown): BranchProjectResult {
  if (!isRecord(value) || !isRecord(value.scenario)) throw new Error('Invalid branch projection response');
  return {
    scenario: adaptBranchScenario(value.scenario),
    projection: isRecord(value.projection) ? value.projection : {}
  };
}

function adaptBranchScenario(value: Record<string, unknown>): BranchScenario {
  return {
    id: stringOrFallback(value.id, ''),
    projectId: stringOrFallback(value.projectId, ''),
    title: stringOrFallback(value.title, ''),
    baseCanonFactIds: stringArrayOrEmpty(value.baseCanonFactIds),
    artifacts: Array.isArray(value.artifacts) ? value.artifacts.filter(isRecord).map(adaptBranchArtifact) : []
  };
}

function adaptPersistedBranchScenarios(value: unknown): PersistedBranchScenario[] {
  return Array.isArray(value) ? value.filter(isRecord).map(adaptPersistedBranchScenario) : [];
}

function adaptPersistedBranchScenario(value: Record<string, unknown>): PersistedBranchScenario {
  return {
    id: stringOrFallback(value.id, ''),
    projectId: stringOrFallback(value.projectId, ''),
    name: stringOrFallback(value.name, ''),
    baseRef: isRecord(value.baseRef) ? value.baseRef : {},
    hypothesis: stringOrFallback(value.hypothesis, ''),
    status: stringOrFallback(value.status, ''),
    payload: value.payload,
    createdAt: stringOrFallback(value.createdAt, ''),
    updatedAt: stringOrFallback(value.updatedAt, '')
  };
}

function adaptBranchArtifact(value: Record<string, unknown>): BranchArtifact {
  return {
    id: stringOrFallback(value.id, ''),
    kind: stringOrFallback(value.kind, ''),
    content: stringOrFallback(value.content, '')
  };
}

function adaptBranchAdoptResult(value: unknown): BranchAdoptResult {
  if (!isRecord(value) || !isRecord(value.canon)) throw new Error('Invalid branch adoption response');
  return {
    canon: {
      canonFactIds: stringArrayOrEmpty(value.canon.canonFactIds),
      artifactIds: stringArrayOrEmpty(value.canon.artifactIds)
    }
  };
}

function adaptRetconProposalResult(value: unknown): RetconProposalResult {
  if (!isRecord(value)) throw new Error('Invalid retcon proposal response');
  return {
    proposal: isRecord(value.proposal) ? value.proposal : {},
    regression: adaptRegressionRunResult(value.regression)
  };
}

function adaptPersistedRetconProposals(value: unknown): PersistedRetconProposal[] {
  return Array.isArray(value) ? value.filter(isRecord).map(adaptPersistedRetconProposal) : [];
}

function adaptPersistedRetconProposal(value: Record<string, unknown>): PersistedRetconProposal {
  return {
    ...value,
    id: stringOrFallback(value.id, ''),
    projectId: stringOrFallback(value.projectId, ''),
    target: isRecord(value.target) ? value.target : undefined,
    status: stringOrFallback(value.status, ''),
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : undefined,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : undefined
  };
}

function adaptPersistedRegressionCheckRuns(value: unknown): PersistedRegressionCheckRun[] {
  return Array.isArray(value) ? value.filter(isRecord).map(adaptPersistedRegressionCheckRun) : [];
}

function adaptPersistedRegressionCheckRun(value: Record<string, unknown>): PersistedRegressionCheckRun {
  return {
    id: stringOrFallback(value.id, ''),
    projectId: stringOrFallback(value.projectId, ''),
    proposalId: stringOrFallback(value.proposalId, ''),
    status: stringOrFallback(value.status, ''),
    checks: Array.isArray(value.checks) ? value.checks : [],
    createdAt: stringOrFallback(value.createdAt, '')
  };
}

function adaptRegressionRunResult(value: unknown): RegressionRunResult {
  if (!isRecord(value)) throw new Error('Invalid regression run response');
  return {
    passed: value.passed === true,
    checks: Array.isArray(value.checks) ? value.checks.filter(isRecord).map(adaptNarrativeRegressionCheck) : []
  };
}

function adaptNarrativeRegressionCheck(value: Record<string, unknown>): NarrativeRegressionCheck {
  return {
    scope: stringOrFallback(value.scope, ''),
    status: stringOrFallback(value.status, ''),
    evidence: stringArrayOrEmpty(value.evidence)
  };
}

function adaptScheduledBackupPolicyList(value: unknown): ScheduledBackupPolicy[] {
  return Array.isArray(value) ? value.filter(isRecord).map(adaptScheduledBackupPolicy) : [];
}

function adaptScheduledBackupDueResult(value: unknown): ScheduledBackupDueResult {
  if (!isRecord(value)) throw new Error('Invalid scheduled backup due response');
  return {
    policies: Array.isArray(value.policies) ? value.policies.filter(isRecord).map(adaptScheduledBackupPolicy) : [],
    intents: Array.isArray(value.intents) ? value.intents.filter(isRecord).map(adaptScheduledBackupIntent) : []
  };
}

function adaptScheduledBackupPolicy(value: unknown): ScheduledBackupPolicy {
  if (!isRecord(value)) throw new Error('Invalid scheduled backup policy response');
  return {
    id: stringOrFallback(value.id, ''),
    projectId: stringOrFallback(value.projectId, ''),
    cadence: stringOrFallback(value.cadence, ''),
    targetPathPrefix: stringOrFallback(value.targetPathPrefix, ''),
    enabled: value.enabled === true,
    lastRunAt: typeof value.lastRunAt === 'string' ? value.lastRunAt : undefined,
    nextRunAt: stringOrFallback(value.nextRunAt, ''),
    retentionCount: numberOrFallback(value.retentionCount, 0),
    lastRunStatus: value.lastRunStatus === 'Succeeded' || value.lastRunStatus === 'Failed' ? value.lastRunStatus : undefined
  };
}

function adaptScheduledBackupIntent(value: Record<string, unknown>): ScheduledBackupIntent {
  return {
    id: stringOrFallback(value.id, ''),
    policyId: stringOrFallback(value.policyId, ''),
    projectId: stringOrFallback(value.projectId, ''),
    targetPathPrefix: stringOrFallback(value.targetPathPrefix, ''),
    scheduledAt: stringOrFallback(value.scheduledAt, '')
  };
}

function adaptRecurringIssueSummaryResult(value: unknown): RecurringIssueSummaryResult {
  const recurringIssues = isRecord(value) && Array.isArray(value.recurringIssues) ? value.recurringIssues : [];
  return {
    recurringIssues: recurringIssues.filter(isRecord).map(adaptRecurringIssueSummary)
  };
}

function adaptRevisionRecheckResult(value: unknown): RevisionRecheckResult {
  if (!isRecord(value)) {
    throw new Error('Invalid revision recheck response');
  }

  return {
    previousManuscriptVersionId: stringOrFallback(value.previousManuscriptVersionId, ''),
    currentManuscriptVersionId: stringOrFallback(value.currentManuscriptVersionId, ''),
    statuses: Array.isArray(value.statuses) ? value.statuses.filter(isRecord).map(adaptRecheckStatusSummary) : [],
    regressions: Array.isArray(value.regressions) ? value.regressions.filter(isRecord).map(adaptReviewLearningTransition) : [],
    recurringIssues: Array.isArray(value.recurringIssues)
      ? value.recurringIssues.filter(isRecord).map(adaptRecurringIssueSummary)
      : []
  };
}

function adaptReviewReportList(value: unknown): ReviewReport[] {
  const rawReports = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.reports)
      ? value.reports
      : [];
  return rawReports.flatMap((report) => (isRecord(report) ? [adaptReviewReport(report)] : []));
}

function adaptReviewReport(value: Record<string, unknown>): ReviewReport {
  const profile = isRecord(value.profile) ? value.profile : {};
  const qualityScore = isRecord(value.qualityScore) ? value.qualityScore : {};

  return {
    id: stringOrFallback(value.id, ''),
    projectId: stringOrFallback(value.projectId, ''),
    manuscriptVersionId: stringOrFallback(value.manuscriptVersionId, ''),
    profile: {
      id: stringOrFallback(profile.id, ''),
      name: stringOrFallback(profile.name, ''),
      enabledCategories: stringArrayOrEmpty(profile.enabledCategories)
    },
    findings: Array.isArray(value.findings) ? value.findings.filter(isRecord).map(adaptReviewFinding) : [],
    qualityScore: {
      overall: numberOrFallback(qualityScore.overall, 0),
      continuity: numberOrFallback(qualityScore.continuity, 0),
      promiseSatisfaction: numberOrFallback(qualityScore.promiseSatisfaction, 0),
      prose: numberOrFallback(qualityScore.prose, 0)
    },
    openFindingCount: numberOrFallback(value.openFindingCount, 0)
  };
}

function adaptReviewFindingActionResult(value: unknown): ReviewFindingActionResult {
  if (!isRecord(value)) throw new Error('Invalid review finding action response');
  return {
    findingId: stringOrFallback(value.findingId, ''),
    action: isReviewFindingActionKind(value.action) ? value.action : 'Accepted',
    previousStatus: isReviewFindingStatus(value.previousStatus) ? value.previousStatus : 'Open',
    nextStatus: isReviewFindingStatus(value.nextStatus) ? value.nextStatus : 'Open',
    decidedBy: typeof value.decidedBy === 'string' ? value.decidedBy : undefined,
    reason: typeof value.reason === 'string' ? value.reason : undefined,
    createdTaskId: typeof value.createdTaskId === 'string' ? value.createdTaskId : undefined,
    occurredAt: stringOrFallback(value.occurredAt, '')
  };
}

function adaptRecurringIssueSummary(value: Record<string, unknown>): RecurringIssueSummary {
  return {
    signature: stringOrFallback(value.signature, ''),
    category: stringOrFallback(value.category, ''),
    occurrenceCount: numberOrFallback(value.occurrenceCount, 0),
    chapterIds: stringArrayOrEmpty(value.chapterIds),
    findingIds: stringArrayOrEmpty(value.findingIds),
    highestSeverity: isReviewSeverity(value.highestSeverity) ? value.highestSeverity : 'Low',
    trend: value.trend === 'Escalating' ? 'Escalating' : 'Recurring',
    risk: isRecurringIssueRisk(value.risk) ? value.risk : 'Medium'
  };
}

function adaptRecheckStatusSummary(value: Record<string, unknown>): RecheckStatusSummary {
  return {
    findingId: stringOrFallback(value.findingId, ''),
    status: isRecheckStatus(value.status) ? value.status : 'Resolved',
    currentFindingId: typeof value.currentFindingId === 'string' ? value.currentFindingId : undefined
  };
}

function adaptReviewLearningTransition(value: Record<string, unknown>): ReviewLearningTransition {
  return {
    finding: isRecord(value.finding) ? adaptReviewFinding(value.finding) : adaptReviewFinding({}),
    event: isRecord(value.event) ? adaptReviewLearningEvent(value.event) : adaptReviewLearningEvent({})
  };
}

function adaptReviewFinding(value: Record<string, unknown>): ReviewFinding {
  return {
    id: stringOrFallback(value.id, ''),
    manuscriptVersionId: stringOrFallback(value.manuscriptVersionId, ''),
    category: stringOrFallback(value.category, ''),
    severity: isReviewSeverity(value.severity) ? value.severity : 'Low',
    problem: stringOrFallback(value.problem, ''),
    evidenceCitations: Array.isArray(value.evidenceCitations)
      ? value.evidenceCitations.filter(isRecord).map((citation) => ({
          sourceId: stringOrFallback(citation.sourceId, ''),
          quote: stringOrFallback(citation.quote, '')
        }))
      : [],
    impact: stringOrFallback(value.impact, ''),
    fixOptions: stringArrayOrEmpty(value.fixOptions),
    autoFixRisk: isAutoFixRisk(value.autoFixRisk) ? value.autoFixRisk : 'Low',
    status: isReviewFindingStatus(value.status) ? value.status : 'Open'
  };
}

function adaptReviewLearningEvent(value: Record<string, unknown>): ReviewLearningEvent {
  return {
    id: stringOrFallback(value.id, ''),
    findingId: stringOrFallback(value.findingId, ''),
    kind: isReviewLearningEventKind(value.kind) ? value.kind : 'Resolved',
    previousStatus: isReviewFindingStatus(value.previousStatus) ? value.previousStatus : 'Open',
    nextStatus: isReviewFindingStatus(value.nextStatus) ? value.nextStatus : 'Resolved',
    manuscriptVersionId: stringOrFallback(value.manuscriptVersionId, ''),
    decidedBy: typeof value.decidedBy === 'string' ? value.decidedBy : undefined,
    reason: typeof value.reason === 'string' ? value.reason : undefined,
    rationale: typeof value.rationale === 'string' ? value.rationale : undefined,
    resolution: typeof value.resolution === 'string' ? value.resolution : undefined,
    detectedByFindingId: typeof value.detectedByFindingId === 'string' ? value.detectedByFindingId : undefined,
    occurredAt: stringOrFallback(value.occurredAt, '')
  };
}

function adaptVersionHistorySnapshotList(value: unknown): VersionHistorySnapshot[] {
  const rawSnapshots = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.snapshots)
      ? value.snapshots
      : [];

  return rawSnapshots.flatMap((snapshot) => (isRecord(snapshot) ? [adaptVersionHistorySnapshot(snapshot)] : []));
}

function adaptVersionHistorySnapshot(value: unknown): VersionHistorySnapshot {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.projectId !== 'string' || !isRecord(value.history)) {
    throw new Error('Invalid version history snapshot response');
  }

  return {
    id: value.id,
    projectId: value.projectId,
    history: adaptVersionHistory(value.history),
    createdAt: stringOrFallback(value.createdAt, '')
  };
}

function adaptVersionHistory(value: Record<string, unknown>): VersionHistory {
  const trace = isRecord(value.trace) ? value.trace : {};
  return {
    entities: Array.isArray(value.entities) ? value.entities.filter(isRecord).map(adaptVersionedEntityRef) : [],
    trace: {
      links: Array.isArray(trace.links) ? trace.links.filter(isRecord).map(adaptVersionTraceLink) : [],
      createdAt: stringOrFallback(trace.createdAt, '')
    },
    restorePoints: Array.isArray(value.restorePoints)
      ? value.restorePoints.filter(isRecord).map((restorePoint) => ({
          entityId: stringOrFallback(restorePoint.entityId, ''),
          version: numberOrFallback(restorePoint.version, 0)
        }))
      : []
  };
}

function adaptVersionedEntityRef(value: Record<string, unknown>): VersionedEntityRef {
  return {
    id: stringOrFallback(value.id, ''),
    type: isVersionedEntityType(value.type) ? value.type : 'artifact',
    version: numberOrFallback(value.version, 0),
    label: stringOrFallback(value.label, '')
  };
}

function adaptVersionTraceLink(value: Record<string, unknown>): VersionTraceLink {
  return {
    from: stringOrFallback(value.from, ''),
    to: stringOrFallback(value.to, ''),
    relation: stringOrFallback(value.relation, '')
  };
}

function adaptGlobalResult(value: Record<string, unknown>): GlobalSearchResult {
  return {
    id: stringOrFallback(value.id, ''),
    projectId: stringOrFallback(value.projectId, ''),
    type: (value.type as GlobalSearchResult['type']) ?? 'manuscript',
    title: stringOrFallback(value.title, ''),
    snippet: stringOrFallback(value.snippet, ''),
    score: typeof value.score === 'number' ? value.score : undefined
  };
}

function adaptApprovalItem(value: Record<string, unknown>): ApprovalItem {
  return {
    id: stringOrFallback(value.id, ''),
    projectId: typeof value.projectId === 'string' ? value.projectId : undefined,
    kind: typeof value.kind === 'string' ? value.kind : undefined,
    targetType: typeof value.targetType === 'string' ? value.targetType : undefined,
    targetId: typeof value.targetId === 'string' ? value.targetId : undefined,
    title: stringOrFallback(value.title, ''),
    riskLevel: typeof value.riskLevel === 'string' ? value.riskLevel : undefined,
    reason: typeof value.reason === 'string' ? value.reason : undefined,
    proposedAction: typeof value.proposedAction === 'string' ? value.proposedAction : undefined,
    status: stringOrFallback(value.status, ''),
    createdAt: stringOrFallback(value.createdAt, '')
  };
}

export async function fetchHealth(baseUrl = '', fetchImpl: FetchImpl = fetch.bind(globalThis)): Promise<HealthResponse> {
  const response = await fetchImpl(`${baseUrl}/health`);
  if (!response.ok) {
    throw new Error(`Health check failed with ${response.status}`);
  }
  return response.json() as Promise<HealthResponse>;
}

async function requestJson(fetchImpl: FetchImpl, url: string, init?: RequestInit): Promise<unknown> {
  const response = init === undefined ? await fetchImpl(url) : await fetchImpl(url, init);
  if (!response.ok) {
    throw new Error(`API request failed with ${response.status}`);
  }
  return response.json() as Promise<unknown>;
}

async function requestJsonOrNull(fetchImpl: FetchImpl, url: string, init?: RequestInit): Promise<unknown | null> {
  const response = init === undefined ? await fetchImpl(url) : await fetchImpl(url, init);
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`API request failed with ${response.status}`);
  }
  return response.json() as Promise<unknown>;
}

function jsonRequest(method: 'PATCH' | 'PUT' | 'POST', body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}

function adaptProjectList(value: unknown): ProjectListItem[] {
  const rawProjects = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.projects)
      ? value.projects
      : [];

  return rawProjects.flatMap((project) => {
    if (!isRecord(project) || typeof project.id !== 'string') return [];
    return [{ id: project.id, title: stringOrFallback(project.title, 'Untitled project') }];
  });
}

function adaptProjectSummary(value: unknown): ProjectSummary {
  if (!isRecord(value) || typeof value.id !== 'string') {
    throw new Error('Invalid project summary response');
  }

  return {
    id: value.id,
    title: stringOrFallback(value.title, 'Untitled project'),
    status: typeof value.status === 'string' ? value.status : undefined,
    externalModelPolicy: value.externalModelPolicy === 'Disabled' ? 'Disabled' : 'Allowed'
  };
}

function adaptChapterList(value: unknown): ChapterSummary[] {
  const rawChapters = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.chapters)
      ? value.chapters
      : [];

  return rawChapters.flatMap((chapter) => {
    if (!isRecord(chapter) || typeof chapter.id !== 'string') return [];
    return [adaptChapterSummary(chapter)];
  });
}

function adaptChapterSummary(chapter: Record<string, unknown>): ChapterSummary {
  return {
    id: stringOrFallback(chapter.id, ''),
    title: stringOrFallback(chapter.title, 'Untitled chapter'),
    manuscriptId: typeof chapter.manuscriptId === 'string' ? chapter.manuscriptId : undefined,
    currentVersionId: typeof chapter.currentVersionId === 'string' ? chapter.currentVersionId : undefined,
    versions: Array.isArray(chapter.versions) ? chapter.versions.filter(isRecord).map(adaptChapterVersion) : []
  };
}

function adaptChapterVersion(value: Record<string, unknown>): ChapterVersionSummary {
  return {
    id: stringOrFallback(value.id, ''),
    chapterId: typeof value.chapterId === 'string' ? value.chapterId : undefined,
    versionNumber: typeof value.versionNumber === 'number' ? value.versionNumber : undefined,
    bodyArtifactId: typeof value.bodyArtifactId === 'string' ? value.bodyArtifactId : undefined,
    status: typeof value.status === 'string' ? value.status : undefined
  };
}

function adaptChapterVersionResponse(value: unknown): ChapterVersionSummary {
  if (!isRecord(value)) {
    throw new Error('Invalid chapter version response');
  }
  return adaptChapterVersion(value);
}

function adaptChapterCurrentBody(value: unknown | null): ChapterCurrentBody | null {
  if (value === null) return null;
  if (!isRecord(value)) {
    throw new Error('Invalid chapter body response');
  }
  return {
    chapterId: stringOrFallback(value.chapterId, ''),
    versionId: stringOrFallback(value.versionId, ''),
    body: stringOrFallback(value.body, '')
  };
}

function adaptCreateProjectChapterResult(value: unknown): CreateProjectChapterResult {
  if (!isRecord(value) || !isRecord(value.chapter) || !isRecord(value.version)) {
    throw new Error('Invalid chapter creation response');
  }

  return {
    chapter: adaptChapterSummary(value.chapter),
    version: adaptChapterVersion(value.version)
  };
}

function adaptWritingRunResult(value: unknown): WritingRunResult {
  if (!isRecord(value) || !isRecord(value.draftArtifact) || !isRecord(value.selfCheckArtifact)) {
    throw new Error('Invalid writing run response');
  }
  const selfCheckResult = isRecord(value.selfCheckArtifact.result) ? value.selfCheckArtifact.result : {};

  return {
    id: stringOrFallback(value.id, ''),
    status: stringOrFallback(value.status, ''),
    manuscriptVersionId: typeof value.manuscriptVersionId === 'string' ? value.manuscriptVersionId : null,
    draftArtifact: {
      id: stringOrFallback(value.draftArtifact.id, ''),
      artifactRecordId:
        typeof value.draftArtifact.artifactRecordId === 'string' ? value.draftArtifact.artifactRecordId : undefined,
      type: stringOrFallback(value.draftArtifact.type, ''),
      status: stringOrFallback(value.draftArtifact.status, ''),
      text: stringOrFallback(value.draftArtifact.text, ''),
      contextPackId: stringOrFallback(value.draftArtifact.contextPackId, '')
    },
    selfCheckArtifact: {
      id: stringOrFallback(value.selfCheckArtifact.id, ''),
      type: stringOrFallback(value.selfCheckArtifact.type, ''),
      status: stringOrFallback(value.selfCheckArtifact.status, ''),
      result: {
        summary: stringOrFallback(selfCheckResult.summary, ''),
        passed: selfCheckResult.passed === true,
        findings: stringArrayOrEmpty(selfCheckResult.findings)
      }
    },
    contextPack: isRecord(value.contextPack)
      ? adaptAgentRoomContextPack(value.contextPack)
      : {
          id: '',
          taskGoal: '',
          agentRole: '',
          riskLevel: '',
          sections: [],
          citations: [],
          exclusions: [],
          warnings: [],
          retrievalTrace: [],
          createdAt: ''
        }
  };
}

function adaptAcceptDraftResult(value: unknown): AcceptDraftResult {
  if (!isRecord(value)) throw new Error('Invalid accept draft response');
  const approvals = Array.isArray(value.approvals) ? value.approvals.filter(isRecord) : [];

  return {
    status: value.status === 'Accepted' ? 'Accepted' : 'PendingApproval',
    projectId: stringOrFallback(value.projectId, ''),
    chapterId: stringOrFallback(value.chapterId, ''),
    versionId: stringOrFallback(value.versionId, ''),
    sourceRunId: stringOrFallback(value.sourceRunId, ''),
    draftArtifactId: stringOrFallback(value.draftArtifactId, ''),
    approvals: approvals.map((approval) => ({
      id: stringOrFallback(approval.id, ''),
      targetType: stringOrFallback(approval.targetType, ''),
      targetId: stringOrFallback(approval.targetId, ''),
      status: stringOrFallback(approval.status, ''),
      riskLevel: stringOrFallback(approval.riskLevel, ''),
      reason: stringOrFallback(approval.reason, '')
    })),
    candidates: Array.isArray(value.candidates) ? value.candidates : []
  };
}

function adaptProviderDefaults(value: unknown): ProviderDefaults {
  if (!isRecord(value) || typeof value.provider !== 'string' || typeof value.defaultModel !== 'string') {
    throw new Error('Invalid provider settings response');
  }

  return {
    provider: value.provider,
    defaultModel: value.defaultModel,
    secretRef: stringOrFallback(value.secretRef, ''),
    redactedMetadata: isRecord(value.redactedMetadata) ? value.redactedMetadata : {},
    updatedAt: stringOrFallback(value.updatedAt, '')
  };
}

function adaptModelRoutingDefaults(value: unknown): ModelRoutingDefaults {
  if (!isRecord(value) || typeof value.draftingModel !== 'string' || typeof value.reviewModel !== 'string') {
    throw new Error('Invalid model routing settings response');
  }

  return {
    provider: stringOrFallback(value.provider, 'openai'),
    draftingModel: value.draftingModel,
    reviewModel: value.reviewModel,
    embeddingModel: typeof value.embeddingModel === 'string' ? value.embeddingModel : undefined,
    updatedAt: stringOrFallback(value.updatedAt, '')
  };
}

function adaptBudgetDefaults(value: unknown): BudgetDefaults {
  if (!isRecord(value) || typeof value.maxRunCostUsd !== 'number') {
    throw new Error('Invalid budget settings response');
  }

  return {
    provider: stringOrFallback(value.provider, 'openai'),
    maxRunCostUsd: value.maxRunCostUsd,
    maxDailyCostUsd: typeof value.maxDailyCostUsd === 'number' ? value.maxDailyCostUsd : undefined,
    maxContextTokens: typeof value.maxContextTokens === 'number' ? value.maxContextTokens : undefined,
    updatedAt: stringOrFallback(value.updatedAt, '')
  };
}

function adaptSourcePolicyDefaults(value: unknown): SourcePolicyDefaults {
  if (!isRecord(value)) {
    throw new Error('Invalid source policy settings response');
  }

  return {
    allowUserSamples: value.allowUserSamples === true,
    allowLicensedSamples: value.allowLicensedSamples === true,
    allowPublicDomain: value.allowPublicDomain !== false,
    restrictedSourceIds: Array.isArray(value.restrictedSourceIds)
      ? value.restrictedSourceIds.filter((id): id is string => typeof id === 'string')
      : [],
    updatedAt: stringOrFallback(value.updatedAt, '')
  };
}

function adaptAgentRoomRunList(value: unknown): AgentRoomRunSummary[] {
  const rawRuns = Array.isArray(value) ? value : isRecord(value) && Array.isArray(value.runs) ? value.runs : [];
  return rawRuns.flatMap((run) => (isRecord(run) && typeof run.id === 'string' ? [adaptAgentRoomRunSummary(run)] : []));
}

function adaptAgentRoomRunDetail(value: unknown): AgentRoomRunDetail {
  if (!isRecord(value) || !isRecord(value.run)) {
    throw new Error('Invalid agent room run detail response');
  }

  const costSummary = isRecord(value.costSummary) ? value.costSummary : {};

  return {
    run: adaptAgentRoomRunSummary(value.run),
    workflowRun: isRecord(value.workflowRun)
      ? {
          id: stringOrFallback(value.workflowRun.id, ''),
          taskContractId: stringOrFallback(value.workflowRun.taskContractId, ''),
          steps: Array.isArray(value.workflowRun.steps) ? value.workflowRun.steps : []
        }
      : null,
    graph: Array.isArray(value.graph)
      ? value.graph.filter(isRecord).map((step) => ({
          id: stringOrFallback(step.id, ''),
          order: numberOrFallback(step.order, 0),
          name: stringOrFallback(step.name, ''),
          status: stringOrFallback(step.status, ''),
          artifactIds: stringArrayOrEmpty(step.artifactIds),
          retryAttempt: numberOrFallback(step.retryAttempt, 0)
        }))
      : [],
    contextPack: isRecord(value.contextPack) ? adaptAgentRoomContextPack(value.contextPack) : null,
    artifacts: Array.isArray(value.artifacts)
      ? value.artifacts.filter(isRecord).map((artifact) => ({
          id: stringOrFallback(artifact.id, ''),
          type: stringOrFallback(artifact.type, ''),
          source: stringOrFallback(artifact.source, ''),
          version: numberOrFallback(artifact.version, 0),
          hash: stringOrFallback(artifact.hash, ''),
          uri: stringOrFallback(artifact.uri, ''),
          relatedRunId: typeof artifact.relatedRunId === 'string' ? artifact.relatedRunId : undefined,
          createdAt: stringOrFallback(artifact.createdAt, '')
        }))
      : [],
    approvals: Array.isArray(value.approvals)
      ? value.approvals.filter(isRecord).map((approval) => ({
          id: stringOrFallback(approval.id, ''),
          runId: typeof approval.runId === 'string' ? approval.runId : undefined,
          status: stringOrFallback(approval.status, ''),
          title: stringOrFallback(approval.title, '')
        }))
      : [],
    durableJob: isRecord(value.durableJob)
      ? {
          id: stringOrFallback(value.durableJob.id, ''),
          workflowType: stringOrFallback(value.durableJob.workflowType, ''),
          status: stringOrFallback(value.durableJob.status, ''),
          retryCount: numberOrFallback(value.durableJob.retryCount, 0),
          replayOfJobId: typeof value.durableJob.replayOfJobId === 'string' ? value.durableJob.replayOfJobId : undefined,
          lineage: stringArrayOrEmpty(value.durableJob.lineage)
        }
      : null,
    costSummary: {
      totalInputTokens: numberOrFallback(costSummary.totalInputTokens, 0),
      totalOutputTokens: numberOrFallback(costSummary.totalOutputTokens, 0),
      totalCostUsd: numberOrFallback(costSummary.totalCostUsd, 0),
      calls: Array.isArray(costSummary.calls)
        ? costSummary.calls.filter(isRecord).map((call) => ({
            id: stringOrFallback(call.id, ''),
            promptVersionId: stringOrFallback(call.promptVersionId, ''),
            provider: stringOrFallback(call.provider, ''),
            model: stringOrFallback(call.model, ''),
            schemaName: typeof call.schemaName === 'string' ? call.schemaName : undefined,
            inputTokens: numberOrFallback(call.inputTokens, 0),
            outputTokens: numberOrFallback(call.outputTokens, 0),
            durationMs: numberOrFallback(call.durationMs, 0),
            estimatedCostUsd: numberOrFallback(call.estimatedCostUsd, 0),
            retryCount: numberOrFallback(call.retryCount, 0),
            status: stringOrFallback(call.status, ''),
            createdAt: stringOrFallback(call.createdAt, '')
          }))
        : []
    }
  };
}

function adaptAgentRoomRunSummary(run: Record<string, unknown>): AgentRoomRunSummary {
  return {
    id: stringOrFallback(run.id, ''),
    agentName: stringOrFallback(run.agentName, 'Unknown agent'),
    taskType: stringOrFallback(run.taskType, ''),
    workflowType: stringOrFallback(run.workflowType, ''),
    promptVersionId: stringOrFallback(run.promptVersionId, ''),
    status: stringOrFallback(run.status, ''),
    jobStatus: typeof run.jobStatus === 'string' ? run.jobStatus : undefined,
    createdAt: stringOrFallback(run.createdAt, ''),
    totalCostUsd: numberOrFallback(run.totalCostUsd, 0),
    pendingApprovalCount: numberOrFallback(run.pendingApprovalCount, 0),
    allowedActions: stringArrayOrEmpty(run.allowedActions),
    contextPackId: typeof run.contextPackId === 'string' ? run.contextPackId : undefined
  };
}

function adaptAgentRoomActionResult(value: unknown): AgentRoomActionResult {
  if (!isRecord(value)) {
    throw new Error('Invalid agent room action response');
  }

  return {
    runId: stringOrFallback(value.runId, ''),
    action: stringOrFallback(value.action, ''),
    status: stringOrFallback(value.status, ''),
    message: typeof value.message === 'string' ? value.message : undefined
  };
}

function adaptProductObservabilitySummary(value: unknown): ProductObservabilitySummary {
  if (!isRecord(value) || !isRecord(value.cost) || !isRecord(value.latency) || !isRecord(value.tokens)) {
    throw new Error('Invalid observability summary response');
  }

  const quality = isRecord(value.quality) ? value.quality : {};
  const adoption = isRecord(value.adoption) ? value.adoption : {};
  const dataQuality = isRecord(value.dataQuality) ? value.dataQuality : undefined;

  return {
    cost: {
      totalUsd: numberOrFallback(value.cost.totalUsd, 0),
      averageUsdPerRun: numberOrFallback(value.cost.averageUsdPerRun, 0)
    },
    latency: {
      averageDurationMs: numberOrFallback(value.latency.averageDurationMs, 0),
      p95DurationMs: numberOrFallback(value.latency.p95DurationMs, 0)
    },
    tokens: {
      total: numberOrFallback(value.tokens.total, 0),
      averagePerRun: numberOrFallback(value.tokens.averagePerRun, 0)
    },
    quality: {
      status: typeof quality.status === 'string' ? quality.status : undefined,
      acceptedRate: numberOrFallback(quality.acceptedRate, 0),
      openIssueCount: numberOrFallback(quality.openIssueCount, 0),
      highSeverityOpenCount: numberOrFallback(quality.highSeverityOpenCount, 0),
      outcomes: numberRecordOrEmpty(quality.outcomes)
    },
    adoption: {
      status: typeof adoption.status === 'string' ? adoption.status : undefined,
      adoptedRate: numberOrFallback(adoption.adoptedRate, 0),
      partialRate: numberOrFallback(adoption.partialRate, 0),
      rejectedRate: numberOrFallback(adoption.rejectedRate, 0),
      byFeature: nestedNumberRecordOrEmpty(adoption.byFeature)
    },
    modelUsage: Array.isArray(value.modelUsage) ? value.modelUsage.filter(isRecord).map(adaptObservabilityModelUsage) : [],
    runErrors: Array.isArray(value.runErrors) ? value.runErrors.filter(isRecord).map(adaptObservabilityRunError) : [],
    workflowBottlenecks: Array.isArray(value.workflowBottlenecks)
      ? value.workflowBottlenecks.filter(isRecord).map(adaptObservabilityWorkflowBottleneck)
      : [],
    dataQuality: dataQuality
      ? {
          openIssueCount: numberOrFallback(dataQuality.openIssueCount, 0),
          highSeverityOpenCount: numberOrFallback(dataQuality.highSeverityOpenCount, 0)
        }
      : undefined
  };
}

function adaptObservabilityModelUsage(value: Record<string, unknown>): ObservabilityModelUsage {
  return {
    modelProvider: stringOrFallback(value.modelProvider, ''),
    modelName: stringOrFallback(value.modelName, 'unknown'),
    runCount: numberOrFallback(value.runCount, 0),
    totalTokens: numberOrFallback(value.totalTokens, 0),
    totalCostUsd: numberOrFallback(value.totalCostUsd, 0)
  };
}

function adaptObservabilityRunError(value: Record<string, unknown>): ObservabilityRunError {
  return {
    code: stringOrFallback(value.code, ''),
    count: numberOrFallback(value.count, 0),
    retryableCount: numberOrFallback(value.retryableCount, 0),
    maxSeverity: stringOrFallback(value.maxSeverity, '')
  };
}

function adaptObservabilityWorkflowBottleneck(value: Record<string, unknown>): ObservabilityWorkflowBottleneck {
  return {
    workflowType: stringOrFallback(value.workflowType, ''),
    stepName: stringOrFallback(value.stepName, ''),
    runCount: numberOrFallback(value.runCount, 0),
    averageDurationMs: numberOrFallback(value.averageDurationMs, 0),
    failureRate: numberOrFallback(value.failureRate, 0),
    retryPressure: numberOrFallback(value.retryPressure, 0)
  };
}

function adaptAgentRoomContextPack(contextPack: Record<string, unknown>): AgentRoomContextPack {
  return {
    id: stringOrFallback(contextPack.id, ''),
    taskGoal: stringOrFallback(contextPack.taskGoal, ''),
    agentRole: stringOrFallback(contextPack.agentRole, ''),
    riskLevel: stringOrFallback(contextPack.riskLevel, ''),
    sections: Array.isArray(contextPack.sections)
      ? contextPack.sections.filter(isRecord).map((section) => ({
          name: stringOrFallback(section.name, ''),
          content: stringOrFallback(section.content, '')
        }))
      : [],
    citations: Array.isArray(contextPack.citations)
      ? contextPack.citations.filter(isRecord).map((citation) => ({
          sourceId: stringOrFallback(citation.sourceId, ''),
          quote: typeof citation.quote === 'string' ? citation.quote : undefined
        }))
      : [],
    exclusions: stringArrayOrEmpty(contextPack.exclusions),
    warnings: stringArrayOrEmpty(contextPack.warnings),
    retrievalTrace: stringArrayOrEmpty(contextPack.retrievalTrace),
    createdAt: stringOrFallback(contextPack.createdAt, '')
  };
}

function adaptBackupWorkflowResult(value: unknown): BackupWorkflowResult {
  if (!isRecord(value) || !isRecord(value.job) || !isRecord(value.status)) {
    throw new Error('Invalid backup workflow response');
  }

  return {
    job: adaptBackupJob(value.job),
    record: isRecord(value.record)
      ? {
          id: stringOrFallback(value.record.id, ''),
          projectId: stringOrFallback(value.record.projectId, ''),
          path: stringOrFallback(value.record.path, ''),
          hash: stringOrFallback(value.record.hash, ''),
          manifest: isRecord(value.record.manifest) ? value.record.manifest : undefined,
          createdAt: stringOrFallback(value.record.createdAt, ''),
          byteLength: typeof value.record.byteLength === 'number' ? value.record.byteLength : undefined
        }
      : undefined,
    status: adaptBackupStatus(value.status)
  };
}

function adaptRestoreBackupResult(value: unknown): RestoreBackupResult {
  if (!isRecord(value) || !isRecord(value.job) || !isRecord(value.status)) {
    throw new Error('Invalid restore backup response');
  }

  return {
    job: adaptBackupJob(value.job),
    record: isRecord(value.record)
      ? {
          id: stringOrFallback(value.record.id, ''),
          backupId: stringOrFallback(value.record.backupId, ''),
          sourceProjectId: typeof value.record.sourceProjectId === 'string' ? value.record.sourceProjectId : undefined,
          targetProjectId: stringOrFallback(value.record.targetProjectId, ''),
          hash: stringOrFallback(value.record.hash, ''),
          requestedBy: typeof value.record.requestedBy === 'string' ? value.record.requestedBy : undefined,
          restoredAt: stringOrFallback(value.record.restoredAt, ''),
          rollbackActions: Array.isArray(value.record.rollbackActions)
            ? value.record.rollbackActions.filter(isRecord).map((action) => ({
                type: stringOrFallback(action.type, ''),
                targetId: stringOrFallback(action.targetId, '')
              }))
            : []
        }
      : undefined,
    status: adaptBackupStatus(value.status)
  };
}

function adaptBackupJob(job: Record<string, unknown>): BackupJob {
  return {
    id: stringOrFallback(job.id, ''),
    type: stringOrFallback(job.type, ''),
    status: stringOrFallback(job.status, ''),
    projectId: stringOrFallback(job.projectId, ''),
    createdAt: stringOrFallback(job.createdAt, ''),
    updatedAt: stringOrFallback(job.updatedAt, ''),
    output: isRecord(job.output) ? job.output : undefined,
    error: typeof job.error === 'string' ? job.error : undefined
  };
}

function adaptBackupStatus(status: Record<string, unknown>): BackupWorkflowResult['status'] {
  return {
    ok: status.ok === true,
    stage: stringOrFallback(status.stage, ''),
    hash: typeof status.hash === 'string' ? status.hash : undefined,
    error: typeof status.error === 'string' ? status.error : undefined
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isVersionedEntityType(value: unknown): value is VersionedEntityType {
  return (
    value === 'manuscript' ||
    value === 'canon' ||
    value === 'prompt' ||
    value === 'run' ||
    value === 'context_pack' ||
    value === 'artifact'
  );
}

function isReviewSeverity(value: unknown): value is ReviewSeverity {
  return value === 'Low' || value === 'Medium' || value === 'High' || value === 'Blocking';
}

function isReviewFindingStatus(value: unknown): value is ReviewFindingStatus {
  return (
    value === 'Open' ||
    value === 'Accepted' ||
    value === 'Applied' ||
    value === 'Rejected' ||
    value === 'FalsePositive' ||
    value === 'Resolved' ||
    value === 'Regression'
  );
}

function isReviewLearningEventKind(value: unknown): value is ReviewLearningEvent['kind'] {
  return (
    value === 'FalsePositive' ||
    value === 'Accepted' ||
    value === 'Rejected' ||
    value === 'Resolved' ||
    value === 'Regression'
  );
}

function isReviewFindingActionKind(value: unknown): value is ReviewFindingActionKind {
  return (
    value === 'Accepted' ||
    value === 'Rejected' ||
    value === 'FalsePositive' ||
    value === 'ApplyRevision' ||
    value === 'ConvertToTask'
  );
}

function isAutoFixRisk(value: unknown): value is ReviewFinding['autoFixRisk'] {
  return value === 'Low' || value === 'Medium' || value === 'High';
}

function isRecurringIssueRisk(value: unknown): value is RecurringIssueSummary['risk'] {
  return value === 'Medium' || value === 'High' || value === 'Blocking';
}

function isRecheckStatus(value: unknown): value is RecheckStatusSummary['status'] {
  return value === 'Resolved' || value === 'Regressed' || value === 'StillOpen';
}

function stringOrFallback(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function numberOrFallback(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function numberRecordOrEmpty(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, number] => typeof entry[1] === 'number'));
}

function nestedNumberRecordOrEmpty(value: unknown): Record<string, Record<string, number>> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, Record<string, unknown>] => isRecord(entry[1]))
      .map(([key, child]) => [key, numberRecordOrEmpty(child)])
  );
}

function stringArrayOrEmpty(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function compact<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, child]) => child !== undefined && child !== '')) as T;
}
