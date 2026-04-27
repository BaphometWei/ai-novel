import { createDatabase } from './connection';
import { migrateDatabase } from './migrate';

const REQUIRED_TABLES = ['prompt_versions', 'provider_settings', 'budget_policies'];

export async function runDatabaseCheck(): Promise<void> {
  const database = createDatabase(':memory:');

  try {
    await migrateDatabase(database.client);
    const foreignKeys = await database.client.execute('PRAGMA foreign_keys');

    if (Number(foreignKeys.rows[0].foreign_keys) !== 1) {
      throw new Error('SQLite foreign keys are not enabled');
    }

    await verifyRequiredTables(database.client);
    await verifyPromptVersionForeignKeys(database.client);
  } finally {
    database.client.close();
  }
}

async function verifyRequiredTables(client: ReturnType<typeof createDatabase>['client']): Promise<void> {
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

async function verifyPromptVersionForeignKeys(client: ReturnType<typeof createDatabase>['client']): Promise<void> {
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
    )`
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
    )`
  );
}

async function expectForeignKeyFailure(
  client: ReturnType<typeof createDatabase>['client'],
  sql: string
): Promise<void> {
  try {
    await client.execute(sql);
  } catch {
    return;
  }

  throw new Error('Prompt version foreign key enforcement failed');
}

if (process.argv[1]?.endsWith('check.ts')) {
  await runDatabaseCheck();
  console.log('SQLite check passed');
}
