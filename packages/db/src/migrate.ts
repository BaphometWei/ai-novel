import type { Client } from '@libsql/client';

const statements = [
  'PRAGMA journal_mode = WAL',
  'PRAGMA foreign_keys = ON',
  `CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    language TEXT NOT NULL,
    status TEXT NOT NULL,
    reader_contract_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS artifacts (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    source TEXT NOT NULL,
    version INTEGER NOT NULL,
    hash TEXT NOT NULL UNIQUE,
    uri TEXT NOT NULL,
    related_run_id TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS manuscripts (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL,
    metadata_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
  )`,
  `CREATE TABLE IF NOT EXISTS chapters (
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
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (current_version_id) REFERENCES chapter_versions(id)
  )`,
  `CREATE TABLE IF NOT EXISTS chapter_versions (
    id TEXT PRIMARY KEY,
    chapter_id TEXT NOT NULL,
    body_artifact_id TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Draft', 'Accepted', 'Rejected', 'Superseded')),
    metadata_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (chapter_id) REFERENCES chapters(id),
    FOREIGN KEY (body_artifact_id) REFERENCES artifacts(id)
  )`,
  `CREATE TABLE IF NOT EXISTS context_packs (
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
  )`,
  `CREATE TABLE IF NOT EXISTS agent_runs (
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
  )`,
  `CREATE TABLE IF NOT EXISTS workflow_runs (
    id TEXT PRIMARY KEY,
    task_contract_id TEXT NOT NULL,
    steps_json TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS durable_jobs (
    id TEXT PRIMARY KEY,
    workflow_type TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    status TEXT NOT NULL,
    retry_count INTEGER NOT NULL,
    replay_of_job_id TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS scheduled_backup_policies (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    cadence TEXT NOT NULL,
    target_path_prefix TEXT NOT NULL,
    enabled INTEGER NOT NULL,
    last_run_at TEXT,
    next_run_at TEXT NOT NULL,
    retention_count INTEGER NOT NULL,
    last_run_status TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS llm_call_logs (
    id TEXT PRIMARY KEY,
    agent_run_id TEXT NOT NULL,
    prompt_version_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    schema_name TEXT,
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    duration_ms INTEGER NOT NULL,
    estimated_cost_usd INTEGER NOT NULL,
    retry_count INTEGER NOT NULL,
    status TEXT NOT NULL,
    error TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (agent_run_id) REFERENCES agent_runs(id),
    FOREIGN KEY (prompt_version_id) REFERENCES prompt_versions(id)
  )`,
  `CREATE TABLE IF NOT EXISTS prompt_versions (
    id TEXT PRIMARY KEY,
    task_type TEXT NOT NULL,
    template TEXT NOT NULL,
    model TEXT NOT NULL,
    provider TEXT NOT NULL,
    version INTEGER NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS provider_settings (
    provider TEXT PRIMARY KEY,
    default_model TEXT NOT NULL,
    secret_ref TEXT NOT NULL,
    redacted_metadata_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS budget_policies (
    provider TEXT PRIMARY KEY,
    max_run_cost_usd INTEGER NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS canon_facts (
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
  )`,
  `CREATE TABLE IF NOT EXISTS approval_requests (
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
  )`,
  `CREATE TABLE IF NOT EXISTS dependency_index_entries (
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
  )`,
  `CREATE TABLE IF NOT EXISTS narrative_state_records (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    type TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    snapshot_version INTEGER NOT NULL,
    snapshot_metadata_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
  )`,
  `CREATE INDEX IF NOT EXISTS narrative_state_records_project_type_idx
    ON narrative_state_records(project_id, type)`,
  `CREATE TABLE IF NOT EXISTS governance_audit_findings (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    finding_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
  )`,
  `CREATE INDEX IF NOT EXISTS governance_audit_findings_project_target_idx
    ON governance_audit_findings(project_id, target_type, target_id)`,
  `CREATE TABLE IF NOT EXISTS governance_approval_references (
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
  )`,
  `CREATE INDEX IF NOT EXISTS governance_approval_references_project_target_idx
    ON governance_approval_references(project_id, target_type, target_id)`,
  `CREATE VIRTUAL TABLE IF NOT EXISTS search_documents USING fts5(
    id UNINDEXED,
    project_id UNINDEXED,
    source_type UNINDEXED,
    title,
    body
  )`,
  `CREATE TABLE IF NOT EXISTS review_reports (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    manuscript_version_id TEXT NOT NULL,
    profile_json TEXT NOT NULL,
    findings_json TEXT NOT NULL,
    quality_score_json TEXT NOT NULL,
    open_finding_count INTEGER NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
  )`,
  `CREATE TABLE IF NOT EXISTS revision_suggestions (
    id TEXT PRIMARY KEY,
    finding_id TEXT NOT NULL,
    manuscript_version_id TEXT NOT NULL,
    title TEXT NOT NULL,
    rationale TEXT NOT NULL,
    diff_json TEXT NOT NULL,
    risk TEXT NOT NULL,
    status TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS review_learning_events (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    profile_id TEXT NOT NULL,
    category TEXT NOT NULL,
    finding_id TEXT NOT NULL,
    event_json TEXT NOT NULL,
    finding_snapshot_json TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
  )`,
  `CREATE INDEX IF NOT EXISTS review_learning_events_project_profile_category_idx
    ON review_learning_events(project_id, profile_id, category)`,
  `CREATE TABLE IF NOT EXISTS recurring_issue_summaries (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    profile_id TEXT NOT NULL,
    category TEXT NOT NULL,
    signature TEXT NOT NULL,
    summary_json TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
  )`,
  `CREATE INDEX IF NOT EXISTS recurring_issue_summaries_project_profile_category_idx
    ON recurring_issue_summaries(project_id, profile_id, category)`,
  `CREATE TABLE IF NOT EXISTS branch_scenarios (
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
  )`,
  `CREATE INDEX IF NOT EXISTS branch_scenarios_project_idx
    ON branch_scenarios(project_id)`,
  `CREATE TABLE IF NOT EXISTS retcon_proposals (
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
  )`,
  `CREATE INDEX IF NOT EXISTS retcon_proposals_project_target_idx
    ON retcon_proposals(project_id, target_type, target_id)`,
  `CREATE TABLE IF NOT EXISTS regression_check_runs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    proposal_id TEXT NOT NULL,
    status TEXT NOT NULL,
    checks_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (proposal_id) REFERENCES retcon_proposals(id)
  )`,
  `CREATE INDEX IF NOT EXISTS regression_check_runs_proposal_idx
    ON regression_check_runs(proposal_id)`,
  `CREATE TABLE IF NOT EXISTS observability_metric_snapshots (
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
  )`,
  `CREATE INDEX IF NOT EXISTS observability_metric_snapshots_project_window_idx
    ON observability_metric_snapshots(project_id, window_start_at, window_end_at)`,
  `CREATE TABLE IF NOT EXISTS serialization_plans (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    platform_profile_json TEXT NOT NULL,
    update_schedule_json TEXT NOT NULL,
    experiments_json TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
  )`,
  `CREATE TABLE IF NOT EXISTS reader_feedback (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    chapter_id TEXT NOT NULL,
    segment TEXT NOT NULL,
    sentiment TEXT NOT NULL,
    tags_json TEXT NOT NULL,
    body TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
  )`,
  `CREATE TABLE IF NOT EXISTS knowledge_items (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    kind TEXT NOT NULL,
    lifecycle_status TEXT NOT NULL,
    material_json TEXT NOT NULL,
    tags_json TEXT NOT NULL,
    embeddings_json TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
  )`,
  `CREATE TABLE IF NOT EXISTS embeddings (
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
  )`,
  `CREATE TABLE IF NOT EXISTS project_bundle_backups (
    hash TEXT PRIMARY KEY,
    path TEXT NOT NULL,
    bundle_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS project_bundle_restores (
    id TEXT PRIMARY KEY,
    bundle_hash TEXT NOT NULL,
    source_project_id_json TEXT NOT NULL,
    target_project_id TEXT NOT NULL,
    restored_at TEXT NOT NULL,
    migrations_applied_json TEXT NOT NULL,
    rollback_actions_json TEXT NOT NULL,
    FOREIGN KEY (bundle_hash) REFERENCES project_bundle_backups(hash)
  )`,
  `CREATE TABLE IF NOT EXISTS project_bundle_restore_items (
    id TEXT PRIMARY KEY,
    restore_id TEXT NOT NULL,
    bundle_hash TEXT NOT NULL,
    target_project_id TEXT NOT NULL,
    section TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    FOREIGN KEY (restore_id) REFERENCES project_bundle_restores(id),
    FOREIGN KEY (bundle_hash) REFERENCES project_bundle_backups(hash)
  )`,
  `CREATE TABLE IF NOT EXISTS version_histories (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    entities_json TEXT NOT NULL,
    trace_links_json TEXT NOT NULL,
    restore_points_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
  )`,
  `CREATE TABLE IF NOT EXISTS migration_history (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL,
    checksum TEXT NOT NULL,
    applied_at TEXT NOT NULL,
    duration_ms INTEGER NOT NULL,
    error TEXT
  )`
];

export async function migrateDatabase(client: Client): Promise<void> {
  for (const statement of statements) {
    await client.execute(statement);
  }

  await ensureColumn(client, 'artifacts', 'related_run_id', 'TEXT');
  await migrateContextPackArtifactForeignKey(client);
  await migrateChapterCurrentVersionForeignKey(client);
  await migratePromptVersionForeignKeys(client);
}

async function ensureColumn(
  client: Client,
  tableName: string,
  columnName: string,
  definition: string
): Promise<void> {
  const result = await client.execute(`PRAGMA table_info(${tableName})`);
  const hasColumn = result.rows.some((row) => row.name === columnName);
  if (!hasColumn) {
    await client.execute(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

async function migrateContextPackArtifactForeignKey(client: Client): Promise<void> {
  const hasArtifactForeignKey = await hasForeignKey(
    client,
    'context_packs',
    'artifact_id',
    'artifacts',
    'id'
  );

  if (hasArtifactForeignKey) {
    return;
  }

  await ensureColumn(client, 'context_packs', 'artifact_id', 'TEXT');
  await client.execute('PRAGMA foreign_keys = OFF');

  try {
    await replaceContextPacksTableWithArtifactForeignKey(client);
  } finally {
    await client.execute('PRAGMA foreign_keys = ON');
  }

  const foreignKeyCheck = await client.execute('PRAGMA foreign_key_check(context_packs)');

  if (foreignKeyCheck.rows.length > 0) {
    throw new Error(
      'Context pack artifact foreign-key migration left invalid references; inspect PRAGMA foreign_key_check output before retrying'
    );
  }
}

async function migrateChapterCurrentVersionForeignKey(client: Client): Promise<void> {
  const hasCurrentVersionForeignKey = await hasForeignKey(
    client,
    'chapters',
    'current_version_id',
    'chapter_versions',
    'id'
  );

  if (hasCurrentVersionForeignKey) {
    return;
  }

  await assertNoDanglingChapterCurrentVersionPointers(client);

  await client.execute('PRAGMA foreign_keys = OFF');

  try {
    await rebuildChaptersTableWithCurrentVersionForeignKey(client);
  } finally {
    await client.execute('PRAGMA foreign_keys = ON');
  }

  const foreignKeyCheck = await client.execute('PRAGMA foreign_key_check(chapters)');

  if (foreignKeyCheck.rows.length > 0) {
    throw new Error(
      'Chapter current-version foreign-key migration left invalid references; inspect PRAGMA foreign_key_check output before retrying'
    );
  }
}

async function assertNoDanglingChapterCurrentVersionPointers(client: Client): Promise<void> {
  const danglingPointers = await client.execute(`
    SELECT chapters.id
    FROM chapters
    LEFT JOIN chapter_versions ON chapter_versions.id = chapters.current_version_id
    WHERE chapters.current_version_id IS NOT NULL AND chapter_versions.id IS NULL
  `);

  if (danglingPointers.rows.length > 0) {
    throw new Error(
      'Cannot migrate chapters.current_version_id foreign key because existing rows reference missing chapter_versions records'
    );
  }
}

async function rebuildChaptersTableWithCurrentVersionForeignKey(client: Client): Promise<void> {
  const temporaryTableName = 'chapters_current_version_fk_migration';
  const columns = [
    'id',
    'manuscript_id',
    'project_id',
    'title',
    'chapter_order',
    'status',
    'current_version_id',
    'metadata_json',
    'created_at',
    'updated_at'
  ];
  const columnList = columns.join(', ');

  await client.execute('BEGIN IMMEDIATE');

  try {
    await client.execute(`CREATE TABLE ${temporaryTableName} (
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
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (current_version_id) REFERENCES chapter_versions(id)
  )`);
    await client.execute(`INSERT INTO ${temporaryTableName} (${columnList}) SELECT ${columnList} FROM chapters`);
    await client.execute('DROP TABLE chapters');
    await client.execute(`ALTER TABLE ${temporaryTableName} RENAME TO chapters`);
    await client.execute('COMMIT');
  } catch (error) {
    await client.execute('ROLLBACK');
    throw error;
  }
}

async function replaceContextPacksTableWithArtifactForeignKey(client: Client): Promise<void> {
  const temporaryTableName = 'context_packs_artifact_fk_migration';
  const columns = [
    'id',
    'artifact_id',
    'task_goal',
    'agent_role',
    'risk_level',
    'sections_json',
    'citations_json',
    'exclusions_json',
    'warnings_json',
    'retrieval_trace_json',
    'created_at'
  ];
  const columnList = columns.join(', ');

  await client.execute('BEGIN IMMEDIATE');

  try {
    await client.execute(`CREATE TABLE ${temporaryTableName} (
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
    await client.execute(`INSERT INTO ${temporaryTableName} (${columnList}) SELECT ${columnList} FROM context_packs`);
    await client.execute('DROP TABLE context_packs');
    await client.execute(`ALTER TABLE ${temporaryTableName} RENAME TO context_packs`);
    await client.execute('COMMIT');
  } catch (error) {
    await client.execute('ROLLBACK');
    throw error;
  }
}

async function migratePromptVersionForeignKeys(client: Client): Promise<void> {
  await backfillMissingPromptVersions(client, 'agent_runs');
  await backfillMissingPromptVersions(client, 'llm_call_logs');

  const agentRunsHasPromptVersionForeignKey = await hasForeignKey(
    client,
    'agent_runs',
    'prompt_version_id',
    'prompt_versions',
    'id'
  );
  const llmCallLogsHasPromptVersionForeignKey = await hasForeignKey(
    client,
    'llm_call_logs',
    'prompt_version_id',
    'prompt_versions',
    'id'
  );

  if (agentRunsHasPromptVersionForeignKey && llmCallLogsHasPromptVersionForeignKey) {
    return;
  }

  await client.execute('PRAGMA foreign_keys = OFF');

  try {
    if (!agentRunsHasPromptVersionForeignKey) {
      await rebuildTable(
        client,
        'agent_runs',
        `CREATE TABLE agent_runs (
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
        )`,
        [
          'id',
          'agent_name',
          'task_type',
          'workflow_type',
          'prompt_version_id',
          'context_pack_id',
          'status',
          'created_at'
        ]
      );
    }

    if (!llmCallLogsHasPromptVersionForeignKey || !agentRunsHasPromptVersionForeignKey) {
      await rebuildTable(
        client,
        'llm_call_logs',
        `CREATE TABLE llm_call_logs (
          id TEXT PRIMARY KEY,
          agent_run_id TEXT NOT NULL,
          prompt_version_id TEXT NOT NULL,
          provider TEXT NOT NULL,
          model TEXT NOT NULL,
          schema_name TEXT,
          input_tokens INTEGER NOT NULL,
          output_tokens INTEGER NOT NULL,
          duration_ms INTEGER NOT NULL,
          estimated_cost_usd INTEGER NOT NULL,
          retry_count INTEGER NOT NULL,
          status TEXT NOT NULL,
          error TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (agent_run_id) REFERENCES agent_runs(id),
          FOREIGN KEY (prompt_version_id) REFERENCES prompt_versions(id)
        )`,
        [
          'id',
          'agent_run_id',
          'prompt_version_id',
          'provider',
          'model',
          'schema_name',
          'input_tokens',
          'output_tokens',
          'duration_ms',
          'estimated_cost_usd',
          'retry_count',
          'status',
          'error',
          'created_at'
        ]
      );
    }
  } finally {
    await client.execute('PRAGMA foreign_keys = ON');
  }

  const foreignKeyCheck = await client.execute('PRAGMA foreign_key_check');

  if (foreignKeyCheck.rows.length > 0) {
    throw new Error(
      'Prompt version foreign-key migration left invalid references; inspect PRAGMA foreign_key_check output before retrying'
    );
  }
}

async function backfillMissingPromptVersions(client: Client, sourceTable: string): Promise<void> {
  await client.execute(`INSERT OR IGNORE INTO prompt_versions (
    id,
    task_type,
    template,
    model,
    provider,
    version,
    status,
    created_at
  )
  SELECT DISTINCT
    prompt_version_id,
    'legacy_migration',
    'Legacy prompt version placeholder',
    'legacy',
    'legacy',
    1,
    'Migrated',
    '2026-04-27T00:00:00.000Z'
  FROM ${sourceTable}
  WHERE prompt_version_id IS NOT NULL`);
}

async function hasForeignKey(
  client: Client,
  tableName: string,
  fromColumn: string,
  referencedTable: string,
  referencedColumn: string
): Promise<boolean> {
  const result = await client.execute(`PRAGMA foreign_key_list(${tableName})`);

  return result.rows.some((row) => {
    return (
      row.from === fromColumn &&
      row.table === referencedTable &&
      row.to === referencedColumn
    );
  });
}

async function rebuildTable(
  client: Client,
  tableName: string,
  createStatement: string,
  columns: string[]
): Promise<void> {
  const temporaryTableName = `${tableName}_prompt_version_fk_migration`;
  const columnList = columns.join(', ');

  await client.execute('BEGIN IMMEDIATE');

  try {
    await client.execute(`ALTER TABLE ${tableName} RENAME TO ${temporaryTableName}`);
    await client.execute(createStatement);
    await client.execute(`INSERT INTO ${tableName} (${columnList}) SELECT ${columnList} FROM ${temporaryTableName}`);
    await client.execute(`DROP TABLE ${temporaryTableName}`);
    await client.execute('COMMIT');
  } catch (error) {
    await client.execute('ROLLBACK');
    throw error;
  }
}
