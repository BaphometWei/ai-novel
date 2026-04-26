import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

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
  createdAt: text('created_at').notNull()
});

export const contextPacks = sqliteTable('context_packs', {
  id: text('id').primaryKey(),
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
  promptVersionId: text('prompt_version_id').notNull(),
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

export const llmCallLogs = sqliteTable('llm_call_logs', {
  id: text('id').primaryKey(),
  agentRunId: text('agent_run_id').notNull().references(() => agentRuns.id),
  promptVersionId: text('prompt_version_id').notNull(),
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
