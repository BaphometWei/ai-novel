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
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS context_packs (
    id TEXT PRIMARY KEY,
    task_goal TEXT NOT NULL,
    agent_role TEXT NOT NULL,
    risk_level TEXT NOT NULL,
    sections_json TEXT NOT NULL,
    citations_json TEXT NOT NULL,
    exclusions_json TEXT NOT NULL,
    warnings_json TEXT NOT NULL,
    retrieval_trace_json TEXT NOT NULL,
    created_at TEXT NOT NULL
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
  )`
];

export async function migrateDatabase(client: Client): Promise<void> {
  for (const statement of statements) {
    await client.execute(statement);
  }

  await migratePromptVersionForeignKeys(client);
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

  await client.execute(`ALTER TABLE ${tableName} RENAME TO ${temporaryTableName}`);
  await client.execute(createStatement);
  await client.execute(`INSERT INTO ${tableName} (${columnList}) SELECT ${columnList} FROM ${temporaryTableName}`);
  await client.execute(`DROP TABLE ${temporaryTableName}`);
}
