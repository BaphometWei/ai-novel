import { describe, expect, it, vi } from 'vitest';
import { migrateDatabase as migrateActualDatabase } from '../migrate';

type CheckClient = {
  execute: (statement: string) => Promise<unknown>;
};

type Migration = (client: CheckClient) => Promise<void>;

describe('runDatabaseCheck', () => {
  it('fails when migration output is missing V2 workflow and job tables', async () => {
    await expect(runCheckWithMigration(createCurrentSchemaWithoutWorkflowRuns)).rejects.toThrow(
      'Required table is missing: workflow_runs'
    );
  });

  it('fails when migration output is missing V2 search FTS capability', async () => {
    await expect(runCheckWithMigration(createCurrentSchemaWithoutSearchDocuments)).rejects.toThrow(
      'Required FTS table is missing: search_documents'
    );
  });

  it('fails when migration output is missing V2 project bundle restore tables', async () => {
    await expect(runCheckWithMigration(createCurrentSchemaWithoutProjectBundleRestoreItems)).rejects.toThrow(
      'Required table is missing: project_bundle_restore_items'
    );
  });

  it('fails when migration output is missing manuscript persistence tables', async () => {
    await expect(runCheckWithMigration(createV21Schema)).rejects.toThrow(
      'Required table is missing: manuscripts'
    );
  });

  it('fails when migration output is missing manuscript persistence foreign keys', async () => {
    await expect(runCheckWithMigration(createSchemaWithMissingChapterVersionArtifactForeignKey)).rejects.toThrow(
      'Required foreign key is missing: chapter_versions.body_artifact_id -> artifacts.id'
    );
  });

  it('fails when migration output is missing current manuscript version foreign keys', async () => {
    await expect(runCheckWithMigration(createSchemaWithMissingCurrentVersionForeignKey)).rejects.toThrow(
      'Required foreign key is missing: chapters.current_version_id -> chapter_versions.id'
    );
  });

  it('fails when migration output is missing migration history table', async () => {
    await expect(runCheckWithMigration(createCurrentSchemaWithoutMigrationHistory)).rejects.toThrow(
      'Required table is missing: migration_history'
    );
  });

  it('fails when migration output is missing scheduled backup policies table', async () => {
    await expect(runCheckWithMigration(createCurrentSchemaWithoutScheduledBackupPolicies)).rejects.toThrow(
      'Required table is missing: scheduled_backup_policies'
    );
  });

  it('fails when migration output is missing V3 narrative state table', async () => {
    await expect(runCheckWithMigration(createCurrentSchemaWithoutNarrativeStateRecords)).rejects.toThrow(
      'Required table is missing: narrative_state_records'
    );
  });

  it('fails when migration output is missing V3 narrative state project/type index', async () => {
    await expect(runCheckWithMigration(createCurrentSchemaWithoutNarrativeStateProjectTypeIndex)).rejects.toThrow(
      'Required index is missing: narrative_state_records_project_type_idx'
    );
  });

  it('fails when migration output is missing V3 governance persistence tables', async () => {
    await expect(runCheckWithMigration(createCurrentSchemaWithoutGovernanceAuditFindings)).rejects.toThrow(
      'Required table is missing: governance_audit_findings'
    );
  });

  it('fails when migration output is missing V3 review learning indexes', async () => {
    await expect(runCheckWithMigration(createCurrentSchemaWithoutReviewLearningEventIndex)).rejects.toThrow(
      'Required index is missing: review_learning_events_project_profile_category_idx'
    );
  });

  it('fails when migration output is missing V3 branch retcon persistence tables', async () => {
    await expect(runCheckWithMigration(createCurrentSchemaWithoutRetconProposals)).rejects.toThrow(
      'Required table is missing: retcon_proposals'
    );
  });

  it('fails when migration output is missing V3 observability metric snapshots table', async () => {
    await expect(runCheckWithMigration(createCurrentSchemaWithoutObservabilityMetricSnapshots)).rejects.toThrow(
      'Required table is missing: observability_metric_snapshots'
    );
  });

  it('fails when migration output is missing V3 observability project/window index', async () => {
    await expect(runCheckWithMigration(createCurrentSchemaWithoutObservabilityProjectWindowIndex)).rejects.toThrow(
      'Required index is missing: observability_metric_snapshots_project_window_idx'
    );
  });
});

async function runCheckWithMigration(migrateDatabase: Migration): Promise<void> {
  vi.resetModules();
  vi.doMock('../migrate', () => ({ migrateDatabase }));
  const { runDatabaseCheck } = await import('../check');

  await runDatabaseCheck();
}

async function createCurrentSchemaWithoutWorkflowRuns(client: CheckClient): Promise<void> {
  await migrateActualDatabase(client as never);
  await client.execute('DROP TABLE workflow_runs');
}

async function createCurrentSchemaWithoutSearchDocuments(client: CheckClient): Promise<void> {
  await migrateActualDatabase(client as never);
  await client.execute('DROP TABLE search_documents');
}

async function createCurrentSchemaWithoutProjectBundleRestoreItems(client: CheckClient): Promise<void> {
  await migrateActualDatabase(client as never);
  await client.execute('DROP TABLE project_bundle_restore_items');
}

async function createCurrentSchemaWithoutMigrationHistory(client: CheckClient): Promise<void> {
  await migrateActualDatabase(client as never);
  await client.execute('DROP TABLE migration_history');
}

async function createCurrentSchemaWithoutScheduledBackupPolicies(client: CheckClient): Promise<void> {
  await migrateActualDatabase(client as never);
  await client.execute('DROP TABLE scheduled_backup_policies');
}

async function createCurrentSchemaWithoutNarrativeStateRecords(client: CheckClient): Promise<void> {
  await migrateActualDatabase(client as never);
  await client.execute('DROP TABLE narrative_state_records');
}

async function createCurrentSchemaWithoutNarrativeStateProjectTypeIndex(client: CheckClient): Promise<void> {
  await migrateActualDatabase(client as never);
  await client.execute('DROP INDEX narrative_state_records_project_type_idx');
}

async function createCurrentSchemaWithoutGovernanceAuditFindings(client: CheckClient): Promise<void> {
  await migrateActualDatabase(client as never);
  await client.execute('DROP TABLE governance_audit_findings');
}

async function createCurrentSchemaWithoutReviewLearningEventIndex(client: CheckClient): Promise<void> {
  await migrateActualDatabase(client as never);
  await client.execute('DROP INDEX review_learning_events_project_profile_category_idx');
}

async function createCurrentSchemaWithoutRetconProposals(client: CheckClient): Promise<void> {
  await migrateActualDatabase(client as never);
  await client.execute('DROP TABLE retcon_proposals');
}

async function createCurrentSchemaWithoutObservabilityMetricSnapshots(client: CheckClient): Promise<void> {
  await migrateActualDatabase(client as never);
  await client.execute('DROP TABLE IF EXISTS observability_metric_snapshots');
}

async function createCurrentSchemaWithoutObservabilityProjectWindowIndex(client: CheckClient): Promise<void> {
  await migrateActualDatabase(client as never);
  await client.execute('DROP INDEX IF EXISTS observability_metric_snapshots_project_window_idx');
}

async function createV21Schema(client: CheckClient): Promise<void> {
  await client.execute('PRAGMA foreign_keys = ON');
  await createProjectAndArtifactTables(client);
  await createPromptAndRunTables(client);
}

async function createSchemaWithMissingChapterVersionArtifactForeignKey(
  client: CheckClient
): Promise<void> {
  await createV21Schema(client);
  await client.execute(`CREATE TABLE manuscripts (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL,
    metadata_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
  )`);
  await client.execute(`CREATE TABLE chapters (
    id TEXT PRIMARY KEY,
    manuscript_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    chapter_order INTEGER NOT NULL,
    status TEXT NOT NULL,
    current_version_id TEXT,
    metadata_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id),
    FOREIGN KEY (project_id) REFERENCES projects(id)
  )`);
  await client.execute(`CREATE TABLE chapter_versions (
    id TEXT PRIMARY KEY,
    chapter_id TEXT NOT NULL,
    body_artifact_id TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    status TEXT NOT NULL,
    metadata_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (chapter_id) REFERENCES chapters(id)
  )`);
  await createRemainingV2Tables(client);
}

async function createSchemaWithMissingCurrentVersionForeignKey(client: CheckClient): Promise<void> {
  await createV21Schema(client);
  await client.execute(`CREATE TABLE manuscripts (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL,
    metadata_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
  )`);
  await client.execute(`CREATE TABLE chapters (
    id TEXT PRIMARY KEY,
    manuscript_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    chapter_order INTEGER NOT NULL,
    status TEXT NOT NULL,
    current_version_id TEXT,
    metadata_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id),
    FOREIGN KEY (project_id) REFERENCES projects(id)
  )`);
  await client.execute(`CREATE TABLE chapter_versions (
    id TEXT PRIMARY KEY,
    chapter_id TEXT NOT NULL,
    body_artifact_id TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    status TEXT NOT NULL,
    metadata_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (chapter_id) REFERENCES chapters(id),
    FOREIGN KEY (body_artifact_id) REFERENCES artifacts(id)
  )`);
  await createRemainingV2Tables(client);
}

async function createRemainingV2Tables(client: CheckClient): Promise<void> {
  await client.execute(`CREATE TABLE workflow_runs (
    id TEXT PRIMARY KEY,
    task_contract_id TEXT NOT NULL,
    steps_json TEXT NOT NULL
  )`);
  await client.execute(`CREATE TABLE durable_jobs (
    id TEXT PRIMARY KEY,
    workflow_type TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    status TEXT NOT NULL,
    retry_count INTEGER NOT NULL,
    replay_of_job_id TEXT
  )`);
  await client.execute(`CREATE TABLE scheduled_backup_policies (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    cadence TEXT NOT NULL,
    target_path_prefix TEXT NOT NULL,
    enabled INTEGER NOT NULL,
    last_run_at TEXT,
    next_run_at TEXT NOT NULL,
    retention_count INTEGER NOT NULL,
    last_run_status TEXT
  )`);
  await client.execute(`CREATE TABLE canon_facts (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    text TEXT NOT NULL,
    status TEXT NOT NULL,
    source_references_json TEXT NOT NULL,
    confirmation_trail_json TEXT NOT NULL,
    ledger_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
  )`);
  await client.execute(`CREATE TABLE approval_requests (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    risk_level TEXT NOT NULL,
    reason TEXT NOT NULL,
    proposed_action TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
  )`);
  await client.execute(`CREATE TABLE dependency_index_entries (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    source_object_json TEXT NOT NULL,
    target_object_json TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    dependency_type TEXT NOT NULL,
    confidence INTEGER NOT NULL,
    source_run_id TEXT NOT NULL,
    invalidation_rule TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
  )`);
  await client.execute(`CREATE TABLE narrative_state_records (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    type TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    snapshot_version INTEGER NOT NULL,
    snapshot_metadata_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
  )`);
  await client.execute(`CREATE INDEX narrative_state_records_project_type_idx
    ON narrative_state_records(project_id, type)`);
  await client.execute(`CREATE TABLE governance_audit_findings (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    finding_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
  )`);
  await client.execute(`CREATE INDEX governance_audit_findings_project_target_idx
    ON governance_audit_findings(project_id, target_type, target_id)`);
  await client.execute(`CREATE TABLE governance_approval_references (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    approval_request_id TEXT NOT NULL,
    status TEXT NOT NULL,
    risk_level TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
  )`);
  await client.execute(`CREATE INDEX governance_approval_references_project_target_idx
    ON governance_approval_references(project_id, target_type, target_id)`);
  await client.execute(`CREATE VIRTUAL TABLE search_documents USING fts5(
    id UNINDEXED,
    project_id UNINDEXED,
    source_type UNINDEXED,
    title,
    body
  )`);
  await client.execute(`CREATE TABLE review_reports (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    manuscript_version_id TEXT NOT NULL,
    profile_json TEXT NOT NULL,
    findings_json TEXT NOT NULL,
    quality_score_json TEXT NOT NULL,
    open_finding_count INTEGER NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
  )`);
  await client.execute(`CREATE TABLE revision_suggestions (
    id TEXT PRIMARY KEY,
    finding_id TEXT NOT NULL,
    manuscript_version_id TEXT NOT NULL,
    title TEXT NOT NULL,
    rationale TEXT NOT NULL,
    diff_json TEXT NOT NULL,
    risk TEXT NOT NULL,
    status TEXT NOT NULL
  )`);
  await client.execute(`CREATE TABLE review_learning_events (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    profile_id TEXT NOT NULL,
    category TEXT NOT NULL,
    finding_id TEXT NOT NULL,
    event_json TEXT NOT NULL,
    finding_snapshot_json TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
  )`);
  await client.execute(`CREATE INDEX review_learning_events_project_profile_category_idx
    ON review_learning_events(project_id, profile_id, category)`);
  await client.execute(`CREATE TABLE recurring_issue_summaries (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    profile_id TEXT NOT NULL,
    category TEXT NOT NULL,
    signature TEXT NOT NULL,
    summary_json TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
  )`);
  await client.execute(`CREATE INDEX recurring_issue_summaries_project_profile_category_idx
    ON recurring_issue_summaries(project_id, profile_id, category)`);
  await client.execute(`CREATE TABLE branch_scenarios (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    base_ref_json TEXT NOT NULL,
    hypothesis TEXT NOT NULL,
    status TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
  )`);
  await client.execute(`CREATE INDEX branch_scenarios_project_idx
    ON branch_scenarios(project_id)`);
  await client.execute(`CREATE TABLE retcon_proposals (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    scenario_id TEXT,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    target_json TEXT NOT NULL,
    impact_report_json TEXT NOT NULL,
    diff_json TEXT NOT NULL,
    regression_checks_json TEXT NOT NULL,
    approval_risk TEXT NOT NULL,
    approval_json TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (scenario_id) REFERENCES branch_scenarios(id)
  )`);
  await client.execute(`CREATE INDEX retcon_proposals_project_target_idx
    ON retcon_proposals(project_id, target_type, target_id)`);
  await client.execute(`CREATE TABLE regression_check_runs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    proposal_id TEXT NOT NULL,
    status TEXT NOT NULL,
    checks_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (proposal_id) REFERENCES retcon_proposals(id)
  )`);
  await client.execute(`CREATE INDEX regression_check_runs_proposal_idx
    ON regression_check_runs(proposal_id)`);
  await client.execute(`CREATE TABLE observability_metric_snapshots (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    window_start_at TEXT NOT NULL,
    window_end_at TEXT NOT NULL,
    captured_at TEXT NOT NULL,
    cost_json TEXT NOT NULL,
    latency_json TEXT NOT NULL,
    tokens_json TEXT NOT NULL,
    quality_json TEXT NOT NULL,
    adoption_json TEXT NOT NULL,
    model_usage_json TEXT NOT NULL,
    run_errors_json TEXT NOT NULL,
    workflow_bottlenecks_json TEXT NOT NULL,
    data_quality_json TEXT NOT NULL,
    source_run_ids_json TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
  )`);
  await client.execute(`CREATE INDEX observability_metric_snapshots_project_window_idx
    ON observability_metric_snapshots(project_id, window_start_at, window_end_at)`);
  await client.execute(`CREATE TABLE serialization_plans (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    platform_profile_json TEXT NOT NULL,
    update_schedule_json TEXT NOT NULL,
    experiments_json TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
  )`);
  await client.execute(`CREATE TABLE reader_feedback (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    chapter_id TEXT NOT NULL,
    segment TEXT NOT NULL,
    sentiment TEXT NOT NULL,
    tags_json TEXT NOT NULL,
    body TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
  )`);
  await client.execute(`CREATE TABLE knowledge_items (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    kind TEXT NOT NULL,
    lifecycle_status TEXT NOT NULL,
    material_json TEXT NOT NULL,
    tags_json TEXT NOT NULL,
    embeddings_json TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
  )`);
  await client.execute(`CREATE TABLE embeddings (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,
    source_type TEXT,
    model TEXT NOT NULL,
    model_version TEXT NOT NULL,
    vector_hash TEXT NOT NULL,
    vector_json TEXT NOT NULL,
    dimensions INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
  await client.execute(`CREATE TABLE project_bundle_backups (
    hash TEXT PRIMARY KEY,
    path TEXT NOT NULL,
    bundle_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);
  await client.execute(`CREATE TABLE project_bundle_restores (
    id TEXT PRIMARY KEY,
    bundle_hash TEXT NOT NULL,
    source_project_id_json TEXT NOT NULL,
    target_project_id TEXT NOT NULL,
    restored_at TEXT NOT NULL,
    migrations_applied_json TEXT NOT NULL,
    rollback_actions_json TEXT NOT NULL,
    FOREIGN KEY (bundle_hash) REFERENCES project_bundle_backups(hash)
  )`);
  await client.execute(`CREATE TABLE project_bundle_restore_items (
    id TEXT PRIMARY KEY,
    restore_id TEXT NOT NULL,
    bundle_hash TEXT NOT NULL,
    target_project_id TEXT NOT NULL,
    section TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    FOREIGN KEY (restore_id) REFERENCES project_bundle_restores(id),
    FOREIGN KEY (bundle_hash) REFERENCES project_bundle_backups(hash)
  )`);
  await client.execute(`CREATE TABLE version_histories (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    entities_json TEXT NOT NULL,
    trace_links_json TEXT NOT NULL,
    restore_points_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
  )`);
  await createMigrationHistoryTable(client);
}

async function createProjectAndArtifactTables(client: CheckClient): Promise<void> {
  await client.execute(`CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    language TEXT NOT NULL,
    status TEXT NOT NULL,
    reader_contract_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
  await client.execute(`CREATE TABLE artifacts (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    source TEXT NOT NULL,
    version INTEGER NOT NULL,
    hash TEXT NOT NULL UNIQUE,
    uri TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);
}

async function createPromptAndRunTables(client: CheckClient): Promise<void> {
  await client.execute(`CREATE TABLE prompt_versions (
    id TEXT PRIMARY KEY,
    task_type TEXT NOT NULL,
    template TEXT NOT NULL,
    model TEXT NOT NULL,
    provider TEXT NOT NULL,
    version INTEGER NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);
  await client.execute(`CREATE TABLE provider_settings (
    provider TEXT PRIMARY KEY,
    default_model TEXT NOT NULL,
    secret_ref TEXT NOT NULL,
    redacted_metadata_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
  await client.execute(`CREATE TABLE budget_policies (
    provider TEXT PRIMARY KEY,
    max_run_cost_usd INTEGER NOT NULL,
    updated_at TEXT NOT NULL
  )`);
  await client.execute(`CREATE TABLE context_packs (
    id TEXT PRIMARY KEY,
    artifact_id TEXT,
    task_goal TEXT NOT NULL,
    agent_role TEXT NOT NULL,
    risk_level TEXT NOT NULL,
    sections_json TEXT NOT NULL,
    citations_json TEXT NOT NULL,
    exclusions_json TEXT NOT NULL,
    warnings_json TEXT NOT NULL,
    retrieval_trace_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (artifact_id) REFERENCES artifacts(id)
  )`);
  await client.execute(`CREATE TABLE agent_runs (
    id TEXT PRIMARY KEY,
    agent_name TEXT NOT NULL,
    task_type TEXT NOT NULL,
    workflow_type TEXT NOT NULL,
    prompt_version_id TEXT NOT NULL,
    context_pack_id TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (prompt_version_id) REFERENCES prompt_versions(id),
    FOREIGN KEY (context_pack_id) REFERENCES context_packs(id)
  )`);
  await client.execute(`CREATE TABLE llm_call_logs (
    id TEXT PRIMARY KEY,
    agent_run_id TEXT NOT NULL,
    prompt_version_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    duration_ms INTEGER NOT NULL,
    estimated_cost_usd INTEGER NOT NULL,
    retry_count INTEGER NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (agent_run_id) REFERENCES agent_runs(id),
    FOREIGN KEY (prompt_version_id) REFERENCES prompt_versions(id)
  )`);
}

async function createMigrationHistoryTable(client: CheckClient): Promise<void> {
  await client.execute(`CREATE TABLE migration_history (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL,
    checksum TEXT NOT NULL,
    applied_at TEXT NOT NULL,
    duration_ms INTEGER NOT NULL,
    error TEXT
  )`);
}
