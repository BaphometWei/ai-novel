import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  language: text('language').notNull(),
  status: text('status').notNull(),
  readerContractJson: text('reader_contract_json').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
});

export const artifacts = sqliteTable('artifacts', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  source: text('source').notNull(),
  version: integer('version').notNull(),
  hash: text('hash').notNull().unique(),
  uri: text('uri').notNull(),
  relatedRunId: text('related_run_id'),
  createdAt: text('created_at').notNull()
});

export const manuscripts = sqliteTable('manuscripts', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  title: text('title').notNull(),
  status: text('status').notNull(),
  metadataJson: text('metadata_json').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
});

export const chapters: any = sqliteTable('chapters', {
  id: text('id').primaryKey(),
  manuscriptId: text('manuscript_id').notNull().references(() => manuscripts.id),
  projectId: text('project_id').notNull().references(() => projects.id),
  title: text('title').notNull(),
  order: integer('chapter_order').notNull(),
  status: text('status').notNull(),
  currentVersionId: text('current_version_id').references(() => chapterVersions.id),
  metadataJson: text('metadata_json').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
});

export const chapterVersions: any = sqliteTable('chapter_versions', {
  id: text('id').primaryKey(),
  chapterId: text('chapter_id').notNull().references(() => chapters.id),
  bodyArtifactId: text('body_artifact_id').notNull().references(() => artifacts.id),
  versionNumber: integer('version_number').notNull(),
  status: text('status').notNull(),
  metadataJson: text('metadata_json').notNull(),
  createdAt: text('created_at').notNull()
});

export const contextPacks = sqliteTable('context_packs', {
  id: text('id').primaryKey(),
  artifactId: text('artifact_id').references(() => artifacts.id),
  taskGoal: text('task_goal').notNull(),
  agentRole: text('agent_role').notNull(),
  riskLevel: text('risk_level').notNull(),
  sectionsJson: text('sections_json').notNull(),
  citationsJson: text('citations_json').notNull(),
  exclusionsJson: text('exclusions_json').notNull(),
  warningsJson: text('warnings_json').notNull(),
  retrievalTraceJson: text('retrieval_trace_json').notNull(),
  createdAt: text('created_at').notNull()
});

export const agentRuns = sqliteTable('agent_runs', {
  id: text('id').primaryKey(),
  agentName: text('agent_name').notNull(),
  taskType: text('task_type').notNull(),
  workflowType: text('workflow_type').notNull(),
  promptVersionId: text('prompt_version_id').notNull().references(() => promptVersions.id),
  contextPackId: text('context_pack_id').notNull().references(() => contextPacks.id),
  status: text('status').notNull(),
  createdAt: text('created_at').notNull()
});

export const workflowRuns = sqliteTable('workflow_runs', {
  id: text('id').primaryKey(),
  taskContractId: text('task_contract_id').notNull(),
  stepsJson: text('steps_json').notNull()
});

export const durableJobs = sqliteTable('durable_jobs', {
  id: text('id').primaryKey(),
  workflowType: text('workflow_type').notNull(),
  payloadJson: text('payload_json').notNull(),
  status: text('status').notNull(),
  retryCount: integer('retry_count').notNull(),
  replayOfJobId: text('replay_of_job_id')
});

export const scheduledBackupPolicies = sqliteTable('scheduled_backup_policies', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  cadence: text('cadence').notNull(),
  targetPathPrefix: text('target_path_prefix').notNull(),
  enabled: integer('enabled').notNull(),
  lastRunAt: text('last_run_at'),
  nextRunAt: text('next_run_at').notNull(),
  retentionCount: integer('retention_count').notNull(),
  lastRunStatus: text('last_run_status')
});

export const llmCallLogs = sqliteTable('llm_call_logs', {
  id: text('id').primaryKey(),
  agentRunId: text('agent_run_id').notNull().references(() => agentRuns.id),
  promptVersionId: text('prompt_version_id').notNull().references(() => promptVersions.id),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  schemaName: text('schema_name'),
  inputTokens: integer('input_tokens').notNull(),
  outputTokens: integer('output_tokens').notNull(),
  durationMs: integer('duration_ms').notNull(),
  estimatedCostUsd: integer('estimated_cost_usd').notNull(),
  retryCount: integer('retry_count').notNull(),
  status: text('status').notNull(),
  error: text('error'),
  createdAt: text('created_at').notNull()
});

export const promptVersions = sqliteTable('prompt_versions', {
  id: text('id').primaryKey(),
  taskType: text('task_type').notNull(),
  template: text('template').notNull(),
  model: text('model').notNull(),
  provider: text('provider').notNull(),
  version: integer('version').notNull(),
  status: text('status').notNull(),
  createdAt: text('created_at').notNull()
});

export const providerSettings = sqliteTable('provider_settings', {
  provider: text('provider').primaryKey(),
  defaultModel: text('default_model').notNull(),
  secretRef: text('secret_ref').notNull(),
  redactedMetadataJson: text('redacted_metadata_json').notNull(),
  updatedAt: text('updated_at').notNull()
});

export const budgetPolicies = sqliteTable('budget_policies', {
  provider: text('provider').primaryKey(),
  maxRunCostUsd: integer('max_run_cost_usd').notNull(),
  updatedAt: text('updated_at').notNull()
});

export const canonFacts = sqliteTable('canon_facts', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  text: text('text').notNull(),
  status: text('status').notNull(),
  sourceReferencesJson: text('source_references_json').notNull(),
  confirmationTrailJson: text('confirmation_trail_json').notNull(),
  ledgerJson: text('ledger_json').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
});

export const approvalRequests = sqliteTable('approval_requests', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  targetType: text('target_type').notNull(),
  targetId: text('target_id').notNull(),
  riskLevel: text('risk_level').notNull(),
  reason: text('reason').notNull(),
  proposedAction: text('proposed_action').notNull(),
  status: text('status').notNull(),
  createdAt: text('created_at').notNull()
});

export const dependencyIndexEntries = sqliteTable('dependency_index_entries', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  sourceObjectJson: text('source_object_json').notNull(),
  targetObjectJson: text('target_object_json').notNull(),
  targetType: text('target_type').notNull(),
  targetId: text('target_id').notNull(),
  dependencyType: text('dependency_type').notNull(),
  confidence: integer('confidence').notNull(),
  sourceRunId: text('source_run_id').notNull(),
  invalidationRule: text('invalidation_rule').notNull()
});

export const narrativeStateRecords = sqliteTable(
  'narrative_state_records',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id').notNull().references(() => projects.id),
    type: text('type').notNull(),
    payloadJson: text('payload_json').notNull(),
    snapshotVersion: integer('snapshot_version').notNull(),
    snapshotMetadataJson: text('snapshot_metadata_json').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  (table) => ({
    projectTypeIdx: index('narrative_state_records_project_type_idx').on(table.projectId, table.type)
  })
);

export const governanceAuditFindings = sqliteTable(
  'governance_audit_findings',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id').notNull().references(() => projects.id),
    targetType: text('target_type').notNull(),
    targetId: text('target_id').notNull(),
    findingJson: text('finding_json').notNull(),
    createdAt: text('created_at').notNull()
  },
  (table) => ({
    projectTargetIdx: index('governance_audit_findings_project_target_idx').on(
      table.projectId,
      table.targetType,
      table.targetId
    )
  })
);

export const governanceApprovalReferences = sqliteTable(
  'governance_approval_references',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id').notNull().references(() => projects.id),
    targetType: text('target_type').notNull(),
    targetId: text('target_id').notNull(),
    approvalRequestId: text('approval_request_id').notNull(),
    status: text('status').notNull(),
    riskLevel: text('risk_level').notNull(),
    reason: text('reason').notNull(),
    createdAt: text('created_at').notNull()
  },
  (table) => ({
    projectTargetIdx: index('governance_approval_references_project_target_idx').on(
      table.projectId,
      table.targetType,
      table.targetId
    )
  })
);

export const reviewReports = sqliteTable('review_reports', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  manuscriptVersionId: text('manuscript_version_id').notNull(),
  profileJson: text('profile_json').notNull(),
  findingsJson: text('findings_json').notNull(),
  qualityScoreJson: text('quality_score_json').notNull(),
  openFindingCount: integer('open_finding_count').notNull()
});

export const revisionSuggestions = sqliteTable('revision_suggestions', {
  id: text('id').primaryKey(),
  findingId: text('finding_id').notNull(),
  manuscriptVersionId: text('manuscript_version_id').notNull(),
  title: text('title').notNull(),
  rationale: text('rationale').notNull(),
  diffJson: text('diff_json').notNull(),
  risk: text('risk').notNull(),
  status: text('status').notNull()
});

export const reviewLearningEvents = sqliteTable(
  'review_learning_events',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id').notNull().references(() => projects.id),
    profileId: text('profile_id').notNull(),
    category: text('category').notNull(),
    findingId: text('finding_id').notNull(),
    eventJson: text('event_json').notNull(),
    findingSnapshotJson: text('finding_snapshot_json').notNull(),
    occurredAt: text('occurred_at').notNull()
  },
  (table) => ({
    projectProfileCategoryIdx: index('review_learning_events_project_profile_category_idx').on(
      table.projectId,
      table.profileId,
      table.category
    )
  })
);

export const recurringIssueSummaries = sqliteTable(
  'recurring_issue_summaries',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id').notNull().references(() => projects.id),
    profileId: text('profile_id').notNull(),
    category: text('category').notNull(),
    signature: text('signature').notNull(),
    summaryJson: text('summary_json').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  (table) => ({
    projectProfileCategoryIdx: index('recurring_issue_summaries_project_profile_category_idx').on(
      table.projectId,
      table.profileId,
      table.category
    )
  })
);

export const branchScenarios = sqliteTable(
  'branch_scenarios',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id').notNull().references(() => projects.id),
    name: text('name').notNull(),
    baseRefJson: text('base_ref_json').notNull(),
    hypothesis: text('hypothesis').notNull(),
    status: text('status').notNull(),
    payloadJson: text('payload_json').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  (table) => ({
    projectIdx: index('branch_scenarios_project_idx').on(table.projectId)
  })
);

export const retconProposals = sqliteTable(
  'retcon_proposals',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id').notNull().references(() => projects.id),
    scenarioId: text('scenario_id').references(() => branchScenarios.id),
    targetType: text('target_type').notNull(),
    targetId: text('target_id').notNull(),
    targetJson: text('target_json').notNull(),
    impactReportJson: text('impact_report_json').notNull(),
    diffJson: text('diff_json').notNull(),
    regressionChecksJson: text('regression_checks_json').notNull(),
    approvalRisk: text('approval_risk').notNull(),
    approvalJson: text('approval_json').notNull(),
    status: text('status').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  (table) => ({
    projectTargetIdx: index('retcon_proposals_project_target_idx').on(
      table.projectId,
      table.targetType,
      table.targetId
    )
  })
);

export const regressionCheckRuns = sqliteTable(
  'regression_check_runs',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id').notNull().references(() => projects.id),
    proposalId: text('proposal_id').notNull().references(() => retconProposals.id),
    status: text('status').notNull(),
    checksJson: text('checks_json').notNull(),
    createdAt: text('created_at').notNull()
  },
  (table) => ({
    proposalIdx: index('regression_check_runs_proposal_idx').on(table.proposalId)
  })
);

export const observabilityMetricSnapshots = sqliteTable(
  'observability_metric_snapshots',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id').notNull().references(() => projects.id),
    windowStartAt: text('window_start_at').notNull(),
    windowEndAt: text('window_end_at').notNull(),
    capturedAt: text('captured_at').notNull(),
    costJson: text('cost_json').notNull(),
    latencyJson: text('latency_json').notNull(),
    tokensJson: text('tokens_json').notNull(),
    qualityJson: text('quality_json').notNull(),
    adoptionJson: text('adoption_json').notNull(),
    modelUsageJson: text('model_usage_json').notNull(),
    runErrorsJson: text('run_errors_json').notNull(),
    workflowBottlenecksJson: text('workflow_bottlenecks_json').notNull(),
    dataQualityJson: text('data_quality_json').notNull(),
    sourceRunIdsJson: text('source_run_ids_json').notNull()
  },
  (table) => ({
    projectWindowIdx: index('observability_metric_snapshots_project_window_idx').on(
      table.projectId,
      table.windowStartAt,
      table.windowEndAt
    )
  })
);

export const serializationPlans = sqliteTable('serialization_plans', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  platformProfileJson: text('platform_profile_json').notNull(),
  updateScheduleJson: text('update_schedule_json').notNull(),
  experimentsJson: text('experiments_json').notNull()
});

export const readerFeedbackRows = sqliteTable('reader_feedback', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  chapterId: text('chapter_id').notNull(),
  segment: text('segment').notNull(),
  sentiment: text('sentiment').notNull(),
  tagsJson: text('tags_json').notNull(),
  body: text('body').notNull()
});

export const knowledgeItems = sqliteTable('knowledge_items', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  title: text('title').notNull(),
  kind: text('kind').notNull(),
  lifecycleStatus: text('lifecycle_status').notNull(),
  materialJson: text('material_json').notNull(),
  tagsJson: text('tags_json').notNull(),
  embeddingsJson: text('embeddings_json').notNull()
});

export const embeddings = sqliteTable('embeddings', {
  id: text('id').primaryKey(),
  sourceId: text('source_id').notNull(),
  sourceType: text('source_type'),
  model: text('model').notNull(),
  modelVersion: text('model_version').notNull(),
  vectorHash: text('vector_hash').notNull(),
  vectorJson: text('vector_json').notNull(),
  dimensions: integer('dimensions').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
});

export const projectBundleBackups = sqliteTable('project_bundle_backups', {
  hash: text('hash').primaryKey(),
  path: text('path').notNull(),
  bundleJson: text('bundle_json').notNull(),
  createdAt: text('created_at').notNull()
});

export const projectBundleRestores = sqliteTable('project_bundle_restores', {
  id: text('id').primaryKey(),
  bundleHash: text('bundle_hash').notNull().references(() => projectBundleBackups.hash),
  sourceProjectIdJson: text('source_project_id_json').notNull(),
  targetProjectId: text('target_project_id').notNull(),
  restoredAt: text('restored_at').notNull(),
  migrationsAppliedJson: text('migrations_applied_json').notNull(),
  rollbackActionsJson: text('rollback_actions_json').notNull()
});

export const projectBundleRestoreItems = sqliteTable('project_bundle_restore_items', {
  id: text('id').primaryKey(),
  restoreId: text('restore_id').notNull().references(() => projectBundleRestores.id),
  bundleHash: text('bundle_hash').notNull().references(() => projectBundleBackups.hash),
  targetProjectId: text('target_project_id').notNull(),
  section: text('section').notNull(),
  payloadJson: text('payload_json').notNull()
});

export const versionHistories = sqliteTable('version_histories', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  entitiesJson: text('entities_json').notNull(),
  traceLinksJson: text('trace_links_json').notNull(),
  restorePointsJson: text('restore_points_json').notNull(),
  createdAt: text('created_at').notNull()
});

export const migrationHistory = sqliteTable('migration_history', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  status: text('status').notNull(),
  checksum: text('checksum').notNull(),
  appliedAt: text('applied_at').notNull(),
  durationMs: integer('duration_ms').notNull(),
  error: text('error')
});
