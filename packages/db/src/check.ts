import { createDatabase } from './connection';
import { migrateDatabase } from './migrate';

type DatabaseClient = ReturnType<typeof createDatabase>['client'];

type RequiredForeignKey = {
  tableName: string;
  fromColumn: string;
  referencedTable: string;
  referencedColumn: string;
};

const REQUIRED_TABLES = [
  'projects',
  'artifacts',
  'manuscripts',
  'chapters',
  'chapter_versions',
  'context_packs',
  'agent_runs',
  'workflow_runs',
  'durable_jobs',
  'scheduled_backup_policies',
  'llm_call_logs',
  'prompt_versions',
  'provider_settings',
  'budget_policies',
  'canon_facts',
  'approval_requests',
  'dependency_index_entries',
  'narrative_state_records',
  'governance_audit_findings',
  'governance_approval_references',
  'review_reports',
  'revision_suggestions',
  'review_learning_events',
  'recurring_issue_summaries',
  'branch_scenarios',
  'retcon_proposals',
  'regression_check_runs',
  'observability_metric_snapshots',
  'serialization_plans',
  'reader_feedback',
  'knowledge_items',
  'embeddings',
  'project_bundle_backups',
  'project_bundle_restores',
  'project_bundle_restore_items',
  'version_histories',
  'migration_history'
];

const REQUIRED_INDEXES = [
  {
    indexName: 'narrative_state_records_project_type_idx',
    tableName: 'narrative_state_records'
  },
  {
    indexName: 'governance_audit_findings_project_target_idx',
    tableName: 'governance_audit_findings'
  },
  {
    indexName: 'governance_approval_references_project_target_idx',
    tableName: 'governance_approval_references'
  },
  {
    indexName: 'review_learning_events_project_profile_category_idx',
    tableName: 'review_learning_events'
  },
  {
    indexName: 'recurring_issue_summaries_project_profile_category_idx',
    tableName: 'recurring_issue_summaries'
  },
  {
    indexName: 'branch_scenarios_project_idx',
    tableName: 'branch_scenarios'
  },
  {
    indexName: 'retcon_proposals_project_target_idx',
    tableName: 'retcon_proposals'
  },
  {
    indexName: 'regression_check_runs_proposal_idx',
    tableName: 'regression_check_runs'
  },
  {
    indexName: 'observability_metric_snapshots_project_window_idx',
    tableName: 'observability_metric_snapshots'
  }
];

const REQUIRED_FOREIGN_KEYS: RequiredForeignKey[] = [
  {
    tableName: 'manuscripts',
    fromColumn: 'project_id',
    referencedTable: 'projects',
    referencedColumn: 'id'
  },
  {
    tableName: 'chapters',
    fromColumn: 'manuscript_id',
    referencedTable: 'manuscripts',
    referencedColumn: 'id'
  },
  {
    tableName: 'chapters',
    fromColumn: 'project_id',
    referencedTable: 'projects',
    referencedColumn: 'id'
  },
  {
    tableName: 'chapter_versions',
    fromColumn: 'chapter_id',
    referencedTable: 'chapters',
    referencedColumn: 'id'
  },
  {
    tableName: 'chapter_versions',
    fromColumn: 'body_artifact_id',
    referencedTable: 'artifacts',
    referencedColumn: 'id'
  },
  {
    tableName: 'chapters',
    fromColumn: 'current_version_id',
    referencedTable: 'chapter_versions',
    referencedColumn: 'id'
  },
  {
    tableName: 'context_packs',
    fromColumn: 'artifact_id',
    referencedTable: 'artifacts',
    referencedColumn: 'id'
  },
  {
    tableName: 'agent_runs',
    fromColumn: 'prompt_version_id',
    referencedTable: 'prompt_versions',
    referencedColumn: 'id'
  },
  {
    tableName: 'agent_runs',
    fromColumn: 'context_pack_id',
    referencedTable: 'context_packs',
    referencedColumn: 'id'
  },
  {
    tableName: 'llm_call_logs',
    fromColumn: 'agent_run_id',
    referencedTable: 'agent_runs',
    referencedColumn: 'id'
  },
  {
    tableName: 'llm_call_logs',
    fromColumn: 'prompt_version_id',
    referencedTable: 'prompt_versions',
    referencedColumn: 'id'
  },
  {
    tableName: 'canon_facts',
    fromColumn: 'project_id',
    referencedTable: 'projects',
    referencedColumn: 'id'
  },
  {
    tableName: 'approval_requests',
    fromColumn: 'project_id',
    referencedTable: 'projects',
    referencedColumn: 'id'
  },
  {
    tableName: 'dependency_index_entries',
    fromColumn: 'project_id',
    referencedTable: 'projects',
    referencedColumn: 'id'
  },
  {
    tableName: 'narrative_state_records',
    fromColumn: 'project_id',
    referencedTable: 'projects',
    referencedColumn: 'id'
  },
  {
    tableName: 'governance_audit_findings',
    fromColumn: 'project_id',
    referencedTable: 'projects',
    referencedColumn: 'id'
  },
  {
    tableName: 'governance_approval_references',
    fromColumn: 'project_id',
    referencedTable: 'projects',
    referencedColumn: 'id'
  },
  {
    tableName: 'review_reports',
    fromColumn: 'project_id',
    referencedTable: 'projects',
    referencedColumn: 'id'
  },
  {
    tableName: 'review_learning_events',
    fromColumn: 'project_id',
    referencedTable: 'projects',
    referencedColumn: 'id'
  },
  {
    tableName: 'recurring_issue_summaries',
    fromColumn: 'project_id',
    referencedTable: 'projects',
    referencedColumn: 'id'
  },
  {
    tableName: 'branch_scenarios',
    fromColumn: 'project_id',
    referencedTable: 'projects',
    referencedColumn: 'id'
  },
  {
    tableName: 'retcon_proposals',
    fromColumn: 'project_id',
    referencedTable: 'projects',
    referencedColumn: 'id'
  },
  {
    tableName: 'retcon_proposals',
    fromColumn: 'scenario_id',
    referencedTable: 'branch_scenarios',
    referencedColumn: 'id'
  },
  {
    tableName: 'regression_check_runs',
    fromColumn: 'project_id',
    referencedTable: 'projects',
    referencedColumn: 'id'
  },
  {
    tableName: 'regression_check_runs',
    fromColumn: 'proposal_id',
    referencedTable: 'retcon_proposals',
    referencedColumn: 'id'
  },
  {
    tableName: 'observability_metric_snapshots',
    fromColumn: 'project_id',
    referencedTable: 'projects',
    referencedColumn: 'id'
  },
  {
    tableName: 'serialization_plans',
    fromColumn: 'project_id',
    referencedTable: 'projects',
    referencedColumn: 'id'
  },
  {
    tableName: 'reader_feedback',
    fromColumn: 'project_id',
    referencedTable: 'projects',
    referencedColumn: 'id'
  },
  {
    tableName: 'knowledge_items',
    fromColumn: 'project_id',
    referencedTable: 'projects',
    referencedColumn: 'id'
  },
  {
    tableName: 'project_bundle_restores',
    fromColumn: 'bundle_hash',
    referencedTable: 'project_bundle_backups',
    referencedColumn: 'hash'
  },
  {
    tableName: 'project_bundle_restore_items',
    fromColumn: 'restore_id',
    referencedTable: 'project_bundle_restores',
    referencedColumn: 'id'
  },
  {
    tableName: 'project_bundle_restore_items',
    fromColumn: 'bundle_hash',
    referencedTable: 'project_bundle_backups',
    referencedColumn: 'hash'
  },
  {
    tableName: 'version_histories',
    fromColumn: 'project_id',
    referencedTable: 'projects',
    referencedColumn: 'id'
  }
];

export async function runDatabaseCheck(): Promise<void> {
  const database = createDatabase(':memory:');

  try {
    await migrateDatabase(database.client);
    const foreignKeys = await database.client.execute('PRAGMA foreign_keys');

    if (Number(foreignKeys.rows[0].foreign_keys) !== 1) {
      throw new Error('SQLite foreign keys are not enabled');
    }

    await verifyRequiredTables(database.client);
    await verifyRequiredIndexes(database.client);
    await verifyFtsSearch(database.client);
    await verifyRequiredForeignKeys(database.client);
    await verifyPromptVersionForeignKeys(database.client);
    await verifyManuscriptForeignKeys(database.client);
    await verifyEmbeddingColumns(database.client);
  } finally {
    database.client.close();
  }
}

async function verifyRequiredIndexes(client: DatabaseClient): Promise<void> {
  for (const requiredIndex of REQUIRED_INDEXES) {
    const result = await client.execute({
      sql: "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = ? AND name = ?",
      args: [requiredIndex.tableName, requiredIndex.indexName]
    });

    if (result.rows.length !== 1) {
      throw new Error(`Required index is missing: ${requiredIndex.indexName}`);
    }
  }
}

async function verifyFtsSearch(client: DatabaseClient): Promise<void> {
  const table = await client.execute({
    sql: "SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name = ?",
    args: ['search_documents']
  });

  if (table.rows.length !== 1) {
    throw new Error('Required FTS table is missing: search_documents');
  }

  const createSql = String(table.rows[0].sql ?? '').toLowerCase();
  if (!createSql.includes('using fts5')) {
    throw new Error('Required FTS5 capability is missing: search_documents');
  }

  const columns = await client.execute('PRAGMA table_info(search_documents)');
  const columnNames = new Set(columns.rows.map((row) => String(row.name)));
  for (const columnName of ['id', 'project_id', 'source_type', 'title', 'body']) {
    if (!columnNames.has(columnName)) {
      throw new Error(`Required FTS column is missing: search_documents.${columnName}`);
    }
  }
}

async function verifyRequiredTables(client: DatabaseClient): Promise<void> {
  for (const tableName of REQUIRED_TABLES) {
    const result = await client.execute({
      sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
      args: [tableName]
    });

    if (result.rows.length !== 1) {
      throw new Error(`Required table is missing: ${tableName}`);
    }
  }
}

async function verifyRequiredForeignKeys(client: DatabaseClient): Promise<void> {
  for (const foreignKey of REQUIRED_FOREIGN_KEYS) {
    const result = await client.execute(`PRAGMA foreign_key_list(${foreignKey.tableName})`);
    const hasForeignKey = result.rows.some((row) => {
      return (
        row.from === foreignKey.fromColumn &&
        row.table === foreignKey.referencedTable &&
        row.to === foreignKey.referencedColumn
      );
    });

    if (!hasForeignKey) {
      throw new Error(
        `Required foreign key is missing: ${foreignKey.tableName}.${foreignKey.fromColumn} -> ${foreignKey.referencedTable}.${foreignKey.referencedColumn}`
      );
    }
  }
}

async function verifyPromptVersionForeignKeys(client: DatabaseClient): Promise<void> {
  await client.execute(`INSERT INTO context_packs (
    id,
    task_goal,
    agent_role,
    risk_level,
    sections_json,
    citations_json,
    exclusions_json,
    warnings_json,
    retrieval_trace_json,
    created_at
  ) VALUES (
    'context_pack_check',
    'Check prompt version FK',
    'DB Check',
    'Low',
    '[]',
    '[]',
    '[]',
    '[]',
    '[]',
    '2026-04-27T06:00:00.000Z'
  )`);

  await expectForeignKeyFailure(
    client,
    `INSERT INTO agent_runs (
      id,
      agent_name,
      task_type,
      workflow_type,
      prompt_version_id,
      context_pack_id,
      status,
      created_at
    ) VALUES (
      'agent_run_check_missing_prompt',
      'DB Check',
      'check',
      'check',
      'prompt_missing',
      'context_pack_check',
      'Queued',
      '2026-04-27T06:00:00.000Z'
    )`,
    'Prompt version foreign key enforcement failed'
  );

  await client.execute(`INSERT INTO prompt_versions (
    id,
    task_type,
    template,
    model,
    provider,
    version,
    status,
    created_at
  ) VALUES (
    'prompt_check',
    'check',
    'Check {{context}}',
    'fake-model',
    'fake',
    1,
    'Active',
    '2026-04-27T06:00:00.000Z'
  )`);

  await client.execute(`INSERT INTO agent_runs (
    id,
    agent_name,
    task_type,
    workflow_type,
    prompt_version_id,
    context_pack_id,
    status,
    created_at
  ) VALUES (
    'agent_run_check',
    'DB Check',
    'check',
    'check',
    'prompt_check',
    'context_pack_check',
    'Queued',
    '2026-04-27T06:00:00.000Z'
  )`);

  await expectForeignKeyFailure(
    client,
    `INSERT INTO llm_call_logs (
      id,
      agent_run_id,
      prompt_version_id,
      provider,
      model,
      input_tokens,
      output_tokens,
      duration_ms,
      estimated_cost_usd,
      retry_count,
      status,
      created_at
    ) VALUES (
      'llm_call_log_check_missing_prompt',
      'agent_run_check',
      'prompt_missing',
      'fake',
      'fake-model',
      1,
      1,
      1,
      1,
      0,
      'Succeeded',
      '2026-04-27T06:00:00.000Z'
    )`,
    'Prompt version foreign key enforcement failed'
  );
}

async function verifyManuscriptForeignKeys(client: DatabaseClient): Promise<void> {
  await client.execute(`INSERT INTO projects (
    id,
    title,
    language,
    status,
    reader_contract_json,
    created_at,
    updated_at
  ) VALUES (
    'project_check',
    'DB Check Project',
    'en',
    'Active',
    '{}',
    '2026-04-27T06:00:00.000Z',
    '2026-04-27T06:00:00.000Z'
  )`);

  await client.execute(`INSERT INTO artifacts (
    id,
    type,
    source,
    version,
    hash,
    uri,
    created_at
  ) VALUES (
    'artifact_check',
    'chapter_body',
    'db-check',
    1,
    'artifact_check_hash',
    'memory://artifact_check',
    '2026-04-27T06:00:00.000Z'
  )`);

  await expectForeignKeyFailure(
    client,
    `INSERT INTO manuscripts (
      id,
      project_id,
      title,
      status,
      metadata_json,
      created_at,
      updated_at
    ) VALUES (
      'manuscript_check_missing_project',
      'project_missing',
      'Missing project manuscript',
      'Draft',
      '{}',
      '2026-04-27T06:00:00.000Z',
      '2026-04-27T06:00:00.000Z'
    )`,
    'Manuscript foreign key enforcement failed'
  );

  await client.execute(`INSERT INTO manuscripts (
    id,
    project_id,
    title,
    status,
    metadata_json,
    created_at,
    updated_at
  ) VALUES (
    'manuscript_check',
    'project_check',
    'DB Check Manuscript',
    'Draft',
    '{}',
    '2026-04-27T06:00:00.000Z',
    '2026-04-27T06:00:00.000Z'
  )`);

  await expectForeignKeyFailure(
    client,
    `INSERT INTO chapters (
      id,
      manuscript_id,
      project_id,
      title,
      chapter_order,
      status,
      metadata_json,
      created_at,
      updated_at
    ) VALUES (
      'chapter_check_missing_manuscript',
      'manuscript_missing',
      'project_check',
      'Missing manuscript chapter',
      1,
      'Draft',
      '{}',
      '2026-04-27T06:00:00.000Z',
      '2026-04-27T06:00:00.000Z'
    )`,
    'Manuscript foreign key enforcement failed'
  );

  await expectForeignKeyFailure(
    client,
    `INSERT INTO chapters (
      id,
      manuscript_id,
      project_id,
      title,
      chapter_order,
      status,
      metadata_json,
      created_at,
      updated_at
    ) VALUES (
      'chapter_check_missing_project',
      'manuscript_check',
      'project_missing',
      'Missing project chapter',
      1,
      'Draft',
      '{}',
      '2026-04-27T06:00:00.000Z',
      '2026-04-27T06:00:00.000Z'
    )`,
    'Manuscript foreign key enforcement failed'
  );

  await client.execute(`INSERT INTO chapters (
    id,
    manuscript_id,
    project_id,
    title,
    chapter_order,
    status,
    metadata_json,
    created_at,
    updated_at
  ) VALUES (
    'chapter_check',
    'manuscript_check',
    'project_check',
    'DB Check Chapter',
    1,
    'Draft',
    '{}',
    '2026-04-27T06:00:00.000Z',
    '2026-04-27T06:00:00.000Z'
  )`);

  await expectForeignKeyFailure(
    client,
    `INSERT INTO chapter_versions (
      id,
      chapter_id,
      body_artifact_id,
      version_number,
      status,
      metadata_json,
      created_at
    ) VALUES (
      'chapter_version_check_missing_chapter',
      'chapter_missing',
      'artifact_check',
      1,
      'Draft',
      '{}',
      '2026-04-27T06:00:00.000Z'
    )`,
    'Manuscript foreign key enforcement failed'
  );

  await expectForeignKeyFailure(
    client,
    `INSERT INTO chapter_versions (
      id,
      chapter_id,
      body_artifact_id,
      version_number,
      status,
      metadata_json,
      created_at
    ) VALUES (
      'chapter_version_check_missing_artifact',
      'chapter_check',
      'artifact_missing',
      1,
      'Draft',
      '{}',
      '2026-04-27T06:00:00.000Z'
    )`,
    'Manuscript foreign key enforcement failed'
  );

  await client.execute(`INSERT INTO chapter_versions (
    id,
    chapter_id,
    body_artifact_id,
    version_number,
    status,
    metadata_json,
    created_at
  ) VALUES (
    'chapter_version_check',
    'chapter_check',
    'artifact_check',
    1,
    'Draft',
    '{}',
    '2026-04-27T06:00:00.000Z'
  )`);
}

async function verifyEmbeddingColumns(client: DatabaseClient): Promise<void> {
  const result = await client.execute('PRAGMA table_info(embeddings)');
  if (result.rows.length === 0) {
    throw new Error('Required table is missing: embeddings');
  }

  const columnNames = new Set(result.rows.map((row) => String(row.name)));
  const requiredColumns = [
    'id',
    'source_id',
    'source_type',
    'model',
    'model_version',
    'vector_hash',
    'vector_json',
    'dimensions',
    'created_at',
    'updated_at'
  ];

  for (const columnName of requiredColumns) {
    if (!columnNames.has(columnName)) {
      throw new Error(`Required embedding column is missing: embeddings.${columnName}`);
    }
  }
}

async function expectForeignKeyFailure(
  client: DatabaseClient,
  sql: string,
  failureMessage: string
): Promise<void> {
  try {
    await client.execute(sql);
  } catch {
    return;
  }

  throw new Error(failureMessage);
}

if (process.argv[1]?.endsWith('check.ts')) {
  await runDatabaseCheck();
  console.log('SQLite check passed');
}
